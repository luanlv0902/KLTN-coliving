import json
import os
import threading
from datetime import datetime, timezone

import psycopg


def database_url():
    value = os.getenv("AI_DATABASE_URL", "").strip()
    if not value:
        raise RuntimeError("AI_DATABASE_URL is missing")
    return value


def sync_user_preference_fields(cursor):
    """Keep preference-derived fields in ai.user_profiles current even if full reconciliation fails."""
    cursor.execute('''
        INSERT INTO ai.user_profiles (
          user_id, budget_min_vnd, budget_max_vnd, preferred_district,
          lifestyle_archetype, priority_cleanliness, priority_social_environment,
          accept_smoking_roommates, accept_pets, source_updated_at
        )
        SELECT p."userId", p."budgetMinVnd", p."budgetMaxVnd", p."preferredDistrict",
               p."lifestyleArchetype", p."priorityCleanliness", p."prioritySocialEnvironment",
               p."acceptSmokingRoommates", p."acceptPets", p."updatedAt"
        FROM preference.user_preferences p
        ON CONFLICT (user_id) DO UPDATE SET
          budget_min_vnd = EXCLUDED.budget_min_vnd,
          budget_max_vnd = EXCLUDED.budget_max_vnd,
          preferred_district = EXCLUDED.preferred_district,
          lifestyle_archetype = EXCLUDED.lifestyle_archetype,
          priority_cleanliness = EXCLUDED.priority_cleanliness,
          priority_social_environment = EXCLUDED.priority_social_environment,
          accept_smoking_roommates = EXCLUDED.accept_smoking_roommates,
          accept_pets = EXCLUDED.accept_pets,
          source_updated_at = GREATEST(
            COALESCE(ai.user_profiles.source_updated_at, '-infinity'::timestamptz),
            EXCLUDED.source_updated_at
          ),
          projected_at = now()
        WHERE (
          ai.user_profiles.budget_min_vnd,
          ai.user_profiles.budget_max_vnd,
          ai.user_profiles.preferred_district,
          ai.user_profiles.lifestyle_archetype,
          ai.user_profiles.priority_cleanliness,
          ai.user_profiles.priority_social_environment,
          ai.user_profiles.accept_smoking_roommates,
          ai.user_profiles.accept_pets,
          ai.user_profiles.source_updated_at
        ) IS DISTINCT FROM (
          EXCLUDED.budget_min_vnd,
          EXCLUDED.budget_max_vnd,
          EXCLUDED.preferred_district,
          EXCLUDED.lifestyle_archetype,
          EXCLUDED.priority_cleanliness,
          EXCLUDED.priority_social_environment,
          EXCLUDED.accept_smoking_roommates,
          EXCLUDED.accept_pets,
          GREATEST(
            COALESCE(ai.user_profiles.source_updated_at, '-infinity'::timestamptz),
            EXCLUDED.source_updated_at
          )
        )
    ''')
    return cursor.rowcount


def reconcile_projections():
    details = {}
    reconcile_room_profiles = os.getenv("AI_RECONCILE_ROOM_PROFILES", "true").lower() == "true"
    sync_room_interactions = os.getenv("AI_SYNC_ROOM_INTERACTIONS", "false").lower() == "true"
    with psycopg.connect(database_url(), connect_timeout=10) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT to_regclass('ai.projection_reconciliation_runs')")
            if cursor.fetchone()[0] is None:
                raise RuntimeError("AI projection schema is not provisioned; run bootstrap before role cutover")
            cursor.execute("SELECT pg_try_advisory_xact_lock(hashtext('ai_projection_reconciliation'))")
            if not cursor.fetchone()[0]:
                return {"status": "SKIPPED", "reason": "LOCKED"}
            cursor.execute("INSERT INTO ai.projection_reconciliation_runs DEFAULT VALUES RETURNING id")
            run_id = cursor.fetchone()[0]

            details["userPreferencesUpserted"] = sync_user_preference_fields(cursor)

            cursor.execute("SAVEPOINT user_full_sync")
            try:
                cursor.execute('''
                    INSERT INTO ai.user_profiles (
                      user_id, email, full_name, role, budget_min_vnd, budget_max_vnd,
                      preferred_district, lifestyle_archetype, priority_cleanliness,
                      priority_social_environment, accept_smoking_roommates, accept_pets,
                      source_updated_at
                    )
                    SELECT u."id", u."email", u."fullName", u."role"::text,
                           p."budgetMinVnd", p."budgetMaxVnd", p."preferredDistrict",
                           p."lifestyleArchetype", p."priorityCleanliness",
                           p."prioritySocialEnvironment", p."acceptSmokingRoommates", p."acceptPets",
                           GREATEST(u."updatedAt", p."updatedAt")
                    FROM identity."User" u
                    LEFT JOIN preference.user_preferences p ON p."userId" = u."id"
                    ON CONFLICT (user_id) DO UPDATE SET
                      email = EXCLUDED.email,
                      full_name = EXCLUDED.full_name,
                      role = EXCLUDED.role,
                      budget_min_vnd = EXCLUDED.budget_min_vnd,
                      budget_max_vnd = EXCLUDED.budget_max_vnd,
                      preferred_district = EXCLUDED.preferred_district,
                      lifestyle_archetype = EXCLUDED.lifestyle_archetype,
                      priority_cleanliness = EXCLUDED.priority_cleanliness,
                      priority_social_environment = EXCLUDED.priority_social_environment,
                      accept_smoking_roommates = EXCLUDED.accept_smoking_roommates,
                      accept_pets = EXCLUDED.accept_pets,
                      source_updated_at = EXCLUDED.source_updated_at,
                      projected_at = now()
                    WHERE (
                      ai.user_profiles.email,
                      ai.user_profiles.full_name,
                      ai.user_profiles.role,
                      ai.user_profiles.budget_min_vnd,
                      ai.user_profiles.budget_max_vnd,
                      ai.user_profiles.preferred_district,
                      ai.user_profiles.lifestyle_archetype,
                      ai.user_profiles.priority_cleanliness,
                      ai.user_profiles.priority_social_environment,
                      ai.user_profiles.accept_smoking_roommates,
                      ai.user_profiles.accept_pets,
                      ai.user_profiles.source_updated_at
                    ) IS DISTINCT FROM (
                      EXCLUDED.email,
                      EXCLUDED.full_name,
                      EXCLUDED.role,
                      EXCLUDED.budget_min_vnd,
                      EXCLUDED.budget_max_vnd,
                      EXCLUDED.preferred_district,
                      EXCLUDED.lifestyle_archetype,
                      EXCLUDED.priority_cleanliness,
                      EXCLUDED.priority_social_environment,
                      EXCLUDED.accept_smoking_roommates,
                      EXCLUDED.accept_pets,
                      EXCLUDED.source_updated_at
                    )
                ''')
                details["usersUpserted"] = cursor.rowcount
                cursor.execute('DELETE FROM ai.user_profiles p WHERE NOT EXISTS (SELECT 1 FROM identity."User" u WHERE u."id" = p.user_id)')
                details["usersDeleted"] = cursor.rowcount
            except Exception as user_error:
                cursor.execute("ROLLBACK TO SAVEPOINT user_full_sync")
                details["usersUpserted"] = details.get("usersUpserted", 0)
                details["usersDeleted"] = 0
                details["usersSyncError"] = str(user_error)[:500]
            finally:
                cursor.execute("RELEASE SAVEPOINT user_full_sync")

            if reconcile_room_profiles:
                cursor.execute("SAVEPOINT room_sync")
                try:
                    cursor.execute('''
                        INSERT INTO ai.room_profiles (
                          room_id, title, address, district, district_id, latitude, longitude, price_value, owner_id, status,
                          cleanliness_required, noise_tolerance, guest_policy, preferred_sleep_habit,
                          max_occupants, current_occupants, allow_smoking, allow_pets, source_updated_at
                        )
                        SELECT "id", "title", "address", "district", "districtId", "latitude", "longitude", "priceValue",
                               "ownerId", "status"::text, "cleanlinessRequired", "noiseTolerance",
                               "guestPolicy", "preferredSleepHabit", "maxOccupants", "currentOccupants",
                               "allowSmoking", "allowPets", "updatedAt"
                        FROM property."Room"
                        ON CONFLICT (room_id) DO UPDATE SET
                          title = EXCLUDED.title,
                          address = EXCLUDED.address,
                          district = EXCLUDED.district,
                          district_id = EXCLUDED.district_id,
                          latitude = EXCLUDED.latitude,
                          longitude = EXCLUDED.longitude,
                          price_value = EXCLUDED.price_value,
                          owner_id = EXCLUDED.owner_id,
                          status = EXCLUDED.status,
                          cleanliness_required = EXCLUDED.cleanliness_required,
                          noise_tolerance = EXCLUDED.noise_tolerance,
                          guest_policy = EXCLUDED.guest_policy,
                          preferred_sleep_habit = EXCLUDED.preferred_sleep_habit,
                          max_occupants = EXCLUDED.max_occupants,
                          current_occupants = EXCLUDED.current_occupants,
                          allow_smoking = EXCLUDED.allow_smoking,
                          allow_pets = EXCLUDED.allow_pets,
                          source_updated_at = EXCLUDED.source_updated_at,
                          projected_at = now()
                        WHERE (
                          ai.room_profiles.title,
                          ai.room_profiles.address,
                          ai.room_profiles.district,
                          ai.room_profiles.district_id,
                          ai.room_profiles.latitude,
                          ai.room_profiles.longitude,
                          ai.room_profiles.price_value,
                          ai.room_profiles.owner_id,
                          ai.room_profiles.status,
                          ai.room_profiles.cleanliness_required,
                          ai.room_profiles.noise_tolerance,
                          ai.room_profiles.guest_policy,
                          ai.room_profiles.preferred_sleep_habit,
                          ai.room_profiles.max_occupants,
                          ai.room_profiles.current_occupants,
                          ai.room_profiles.allow_smoking,
                          ai.room_profiles.allow_pets,
                          ai.room_profiles.source_updated_at
                        ) IS DISTINCT FROM (
                          EXCLUDED.title,
                          EXCLUDED.address,
                          EXCLUDED.district,
                          EXCLUDED.district_id,
                          EXCLUDED.latitude,
                          EXCLUDED.longitude,
                          EXCLUDED.price_value,
                          EXCLUDED.owner_id,
                          EXCLUDED.status,
                          EXCLUDED.cleanliness_required,
                          EXCLUDED.noise_tolerance,
                          EXCLUDED.guest_policy,
                          EXCLUDED.preferred_sleep_habit,
                          EXCLUDED.max_occupants,
                          EXCLUDED.current_occupants,
                          EXCLUDED.allow_smoking,
                          EXCLUDED.allow_pets,
                          EXCLUDED.source_updated_at
                        )
                    ''')
                    details["roomsUpserted"] = cursor.rowcount
                    cursor.execute('DELETE FROM ai.room_profiles p WHERE NOT EXISTS (SELECT 1 FROM property."Room" r WHERE r."id" = p.room_id)')
                    details["roomsDeleted"] = cursor.rowcount
                except Exception as room_error:
                    cursor.execute("ROLLBACK TO SAVEPOINT room_sync")
                    details["roomsUpserted"] = 0
                    details["roomsDeleted"] = 0
                    details["roomsSyncError"] = str(room_error)[:500]
                finally:
                    cursor.execute("RELEASE SAVEPOINT room_sync")
            else:
                details["roomsUpserted"] = 0
                details["roomsDeleted"] = 0

            cursor.execute("SAVEPOINT occupancy_sync")
            try:
                cursor.execute('''
                    INSERT INTO ai.occupancy_profiles (room_id, user_id, status, source_updated_at)
                    SELECT "roomId", "userId", "status"::text, COALESCE("terminatedAt", "joinedAt")
                    FROM rental.occupancy
                    ON CONFLICT (room_id, user_id) DO UPDATE SET
                      status = EXCLUDED.status,
                      source_updated_at = EXCLUDED.source_updated_at,
                      projected_at = now()
                    WHERE (ai.occupancy_profiles.status, ai.occupancy_profiles.source_updated_at)
                      IS DISTINCT FROM (EXCLUDED.status, EXCLUDED.source_updated_at)
                ''')
                details["occupancyUpserted"] = cursor.rowcount
                cursor.execute('''
                    DELETE FROM ai.occupancy_profiles p WHERE NOT EXISTS (
                      SELECT 1 FROM rental.occupancy o
                      WHERE o."roomId" = p.room_id AND o."userId" = p.user_id
                    )
                ''')
                details["occupancyDeleted"] = cursor.rowcount
            except Exception as occupancy_error:
                cursor.execute("ROLLBACK TO SAVEPOINT occupancy_sync")
                details["occupancyUpserted"] = 0
                details["occupancyDeleted"] = 0
                details["occupancySyncError"] = str(occupancy_error)[:500]
            finally:
                cursor.execute("RELEASE SAVEPOINT occupancy_sync")

            if sync_room_interactions:
                cursor.execute("SAVEPOINT interactions_sync")
                try:
                    cursor.execute('''
                        INSERT INTO ai.room_interactions (
                          interaction_id, user_id, room_id, interaction_type,
                          interaction_value, source_created_at
                        )
                        SELECT "id", "userId", "roomId", "interactionType"::text,
                               "interactionValue", "createdAt"
                        FROM preference."RoomInteraction"
                        ON CONFLICT (interaction_id) DO UPDATE SET
                          user_id = EXCLUDED.user_id,
                          room_id = EXCLUDED.room_id,
                          interaction_type = EXCLUDED.interaction_type,
                          interaction_value = EXCLUDED.interaction_value,
                          source_created_at = EXCLUDED.source_created_at,
                          projected_at = now()
                        WHERE (
                          ai.room_interactions.user_id,
                          ai.room_interactions.room_id,
                          ai.room_interactions.interaction_type,
                          ai.room_interactions.interaction_value,
                          ai.room_interactions.source_created_at
                        ) IS DISTINCT FROM (
                          EXCLUDED.user_id,
                          EXCLUDED.room_id,
                          EXCLUDED.interaction_type,
                          EXCLUDED.interaction_value,
                          EXCLUDED.source_created_at
                        )
                    ''')
                    details["interactionsUpserted"] = cursor.rowcount
                    cursor.execute('''
                        DELETE FROM ai.room_interactions p WHERE NOT EXISTS (
                          SELECT 1 FROM preference."RoomInteraction" i WHERE i."id" = p.interaction_id
                        )
                    ''')
                    details["interactionsDeleted"] = cursor.rowcount
                except Exception as interaction_error:
                    cursor.execute("ROLLBACK TO SAVEPOINT interactions_sync")
                    details["interactionsUpserted"] = 0
                    details["interactionsDeleted"] = 0
                    details["interactionsSyncError"] = str(interaction_error)[:500]
                finally:
                    cursor.execute("RELEASE SAVEPOINT interactions_sync")
            else:
                details["interactionsUpserted"] = 0
                details["interactionsDeleted"] = 0

            cursor.execute('''
                UPDATE ai.projection_reconciliation_runs
                SET status = 'COMPLETED', completed_at = now(), details = %s::jsonb
                WHERE id = %s
            ''', (json.dumps(details), run_id))
    return {"status": "COMPLETED", "runId": str(run_id), "details": details}


class ProjectionReconciliationScheduler:
    def __init__(self):
        self.stop_event = threading.Event()
        self.thread = None
        self.lock = threading.Lock()
        self.last_status = {"status": "NOT_RUN"}

    def start(self):
        interval = int(os.getenv("AI_RECONCILIATION_INTERVAL_SECONDS", "86400"))
        if interval <= 0 or os.getenv("AI_USE_PROJECTIONS", "false").lower() != "true":
            return
        self.thread = threading.Thread(target=self._run, args=(interval,), name="ai-reconciliation", daemon=True)
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=5)

    def snapshot(self):
        with self.lock:
            return dict(self.last_status)

    def _set_status(self, value):
        with self.lock:
            self.last_status = value

    def _run_once(self):
        started_at = datetime.now(timezone.utc).isoformat()
        self._set_status({"status": "RUNNING", "startedAt": started_at})
        try:
            result = reconcile_projections()
            from utils.loader_supabase import refresh_projection_cache
            refresh_projection_cache()
            self._set_status({**result, "startedAt": started_at, "completedAt": datetime.now(timezone.utc).isoformat()})
        except Exception as error:
            self._set_status({"status": "FAILED", "startedAt": started_at, "error": str(error)[:1000]})
            print(f"[AI] Projection reconciliation failed: {error}")

    def _run(self, interval):
        if os.getenv("AI_RECONCILIATION_RUN_ON_START", "true").lower() == "true":
            self._run_once()
        while not self.stop_event.wait(interval):
            self._run_once()
