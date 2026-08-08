import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

load_dotenv()


def database_url():
    value = os.getenv("AI_DATABASE_URL", os.getenv("DATABASE_URL", "")).strip()
    if not value:
        raise RuntimeError("AI_DATABASE_URL or DATABASE_URL is missing")
    return value


def bootstrap():
    migration = Path(__file__).parents[1] / "migrations" / "0001_ai_projections.sql"
    reset_tables = os.getenv("AI_BOOTSTRAP_RESET_TABLES", "false").lower() == "true"
    sync_room_interactions = os.getenv("AI_SYNC_ROOM_INTERACTIONS", "false").lower() == "true"
    with psycopg.connect(database_url(), connect_timeout=10) as connection:
        with connection.cursor() as cursor:
            if os.getenv("AI_PROVISION_SCHEMA", "false").lower() == "true":
                cursor.execute(migration.read_text(encoding="utf-8"))
            else:
                cursor.execute("SELECT to_regclass('ai.user_profiles')")
                if cursor.fetchone()[0] is None:
                    raise RuntimeError(
                        "AI projection schema is missing; provision it with an admin connection before role cutover"
                    )

            cursor.execute('ALTER TABLE ai.room_profiles ADD COLUMN IF NOT EXISTS latitude double precision')
            cursor.execute('ALTER TABLE ai.room_profiles ADD COLUMN IF NOT EXISTS longitude double precision')

            if reset_tables:
                truncate_tables = ["ai.user_profiles", "ai.room_profiles", "ai.occupancy_profiles"]
                if sync_room_interactions:
                    truncate_tables.append("ai.room_interactions")
                cursor.execute("TRUNCATE " + ", ".join(truncate_tables))
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
                       p."prioritySocialEnvironment", p."acceptSmokingRoommates",
                       p."acceptPets", GREATEST(u."updatedAt", p."updatedAt")
                FROM identity."User" u
                LEFT JOIN preference.user_preferences p ON p."userId" = u."id"
            ''')
            cursor.execute('''
                INSERT INTO ai.room_profiles (
                                    room_id, title, address, district, district_id, latitude, longitude, price_value, owner_id,
                  status, cleanliness_required, noise_tolerance, guest_policy,
                  preferred_sleep_habit, max_occupants, current_occupants,
                  allow_smoking, allow_pets, source_updated_at
                )
                                SELECT "id", "title", "address", "district", "districtId", "latitude", "longitude", "priceValue",
                       "ownerId", "status"::text, "cleanlinessRequired", "noiseTolerance",
                       "guestPolicy", "preferredSleepHabit", "maxOccupants",
                       "currentOccupants", "allowSmoking", "allowPets", "updatedAt"
                FROM property."Room"
            ''')
            cursor.execute('''
                INSERT INTO ai.occupancy_profiles (
                  room_id, user_id, status, source_updated_at
                )
                SELECT "roomId", "userId", "status"::text, COALESCE("terminatedAt", "joinedAt")
                FROM rental.occupancy
            ''')
                        if sync_room_interactions:
                                cursor.execute('''
                                        INSERT INTO ai.room_interactions (
                                            interaction_id, user_id, room_id, interaction_type,
                                            interaction_value, source_created_at
                                        )
                                        SELECT "id", "userId", "roomId", "interactionType"::text,
                                                     "interactionValue", "createdAt"
                                        FROM preference."RoomInteraction"
                                ''')

            counts = {}
            for table in ("user_profiles", "room_profiles", "occupancy_profiles", "room_interactions"):
                cursor.execute(f"SELECT count(*) FROM ai.{table}")
                counts[table] = cursor.fetchone()[0]
    return counts


if __name__ == "__main__":
    result = bootstrap()
    print(
        "AI projections bootstrapped (reset="
        + os.getenv("AI_BOOTSTRAP_RESET_TABLES", "false")
        + "): "
        + ", ".join(f"{key}={value}" for key, value in result.items())
    )
