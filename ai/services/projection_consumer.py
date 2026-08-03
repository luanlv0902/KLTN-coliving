import json
import os
import threading
import time

import pika
import psycopg


BINDINGS = [
    "identity.user.changed",
    "property.room.changed",
    "preference.user-preference.changed",
    "preference.room-interaction.changed",
    "rental.occupancy-profile.changed",
]
def _database_url():
    value = os.getenv("AI_DATABASE_URL", "").strip()
    if not value:
        raise RuntimeError("AI_DATABASE_URL is missing")
    return value


def _upsert_event(cursor, event):
    return False
    event_type = event.get("eventType")
    payload = event.get("payload") or {}

    if event_type == "identity.user.changed":
        cursor.execute('''
            INSERT INTO ai.user_profiles (user_id, email, full_name, role, source_updated_at)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (user_id) DO UPDATE SET
              email = EXCLUDED.email, full_name = EXCLUDED.full_name,
              role = EXCLUDED.role, source_updated_at = EXCLUDED.source_updated_at,
              projected_at = now()
        ''', (payload.get("userId"), payload.get("email"), payload.get("fullName"),
              payload.get("role"), payload.get("updatedAt")))
    elif event_type == "preference.user-preference.changed":
        cursor.execute('''
            INSERT INTO ai.user_profiles (
              user_id, budget_min_vnd, budget_max_vnd, preferred_district,
              lifestyle_archetype, priority_cleanliness, priority_social_environment,
              accept_smoking_roommates, accept_pets, source_updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id) DO UPDATE SET
              budget_min_vnd = EXCLUDED.budget_min_vnd,
              budget_max_vnd = EXCLUDED.budget_max_vnd,
              preferred_district = EXCLUDED.preferred_district,
              lifestyle_archetype = EXCLUDED.lifestyle_archetype,
              priority_cleanliness = EXCLUDED.priority_cleanliness,
              priority_social_environment = EXCLUDED.priority_social_environment,
              accept_smoking_roommates = EXCLUDED.accept_smoking_roommates,
              accept_pets = EXCLUDED.accept_pets,
              source_updated_at = EXCLUDED.source_updated_at, projected_at = now()
        ''', (payload.get("userId"), payload.get("budgetMinVnd"), payload.get("budgetMaxVnd"),
              payload.get("preferredDistrict"), payload.get("lifestyleArchetype"),
              payload.get("priorityCleanliness"), payload.get("prioritySocialEnvironment"),
              payload.get("acceptSmokingRoommates"), payload.get("acceptPets"), payload.get("updatedAt")))
    elif event_type == "property.room.changed":
        cursor.execute('''
            INSERT INTO ai.room_profiles (
              room_id, title, address, district, district_id, price_value, owner_id, status,
              cleanliness_required, noise_tolerance, guest_policy, preferred_sleep_habit,
              max_occupants, current_occupants, allow_smoking, allow_pets, source_updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (room_id) DO UPDATE SET
              title = EXCLUDED.title, address = EXCLUDED.address, district = EXCLUDED.district,
              district_id = EXCLUDED.district_id, price_value = EXCLUDED.price_value,
              owner_id = EXCLUDED.owner_id, status = EXCLUDED.status,
              cleanliness_required = EXCLUDED.cleanliness_required,
              noise_tolerance = EXCLUDED.noise_tolerance, guest_policy = EXCLUDED.guest_policy,
              preferred_sleep_habit = EXCLUDED.preferred_sleep_habit,
              max_occupants = EXCLUDED.max_occupants,
              current_occupants = EXCLUDED.current_occupants,
              allow_smoking = EXCLUDED.allow_smoking, allow_pets = EXCLUDED.allow_pets,
              source_updated_at = EXCLUDED.source_updated_at, projected_at = now()
        ''', (payload.get("id"), payload.get("title"), payload.get("address"),
              payload.get("district"), payload.get("districtId"), payload.get("priceValue"),
              payload.get("ownerId"), payload.get("status"), payload.get("cleanlinessRequired"),
              payload.get("noiseTolerance"), payload.get("guestPolicy"),
              payload.get("preferredSleepHabit"), payload.get("maxOccupants"),
              payload.get("currentOccupants"), payload.get("allowSmoking"),
              payload.get("allowPets"), payload.get("updatedAt")))
    elif event_type == "rental.occupancy-profile.changed":
        cursor.execute('''
            INSERT INTO ai.occupancy_profiles (room_id, user_id, status, source_updated_at)
            VALUES (%s, %s, %s, COALESCE(%s::timestamptz, %s::timestamptz))
            ON CONFLICT (room_id, user_id) DO UPDATE SET
              status = EXCLUDED.status, source_updated_at = EXCLUDED.source_updated_at,
              projected_at = now()
        ''', (payload.get("roomId"), payload.get("userId"), payload.get("status"),
              payload.get("terminatedAt"), payload.get("joinedAt")))
    elif event_type == "preference.room-interaction.changed":
        cursor.execute('''
            INSERT INTO ai.room_interactions (
              interaction_id, user_id, room_id, interaction_type,
              interaction_value, source_created_at
            ) VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (interaction_id) DO UPDATE SET
              interaction_type = EXCLUDED.interaction_type,
              interaction_value = EXCLUDED.interaction_value,
              projected_at = now()
        ''', (payload.get("id"), payload.get("userId"), payload.get("roomId"),
              payload.get("interactionType"), payload.get("interactionValue"), payload.get("createdAt")))
    else:
        raise ValueError(f"Unsupported projection event: {event_type}")


def process_event(event):
    return False
    event_id = str(event.get("id") or "")
    if not event_id:
        raise ValueError("Projection event id is missing")
    with psycopg.connect(_database_url(), connect_timeout=10) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM ai.processed_events WHERE event_id = %s", (event_id,))
            if cursor.fetchone():
                return False
            _upsert_event(cursor, event)
            cursor.execute('''
                INSERT INTO ai.processed_events (event_id, event_type, source_service)
                VALUES (%s, %s, %s)
            ''', (event_id, event.get("eventType"), event.get("sourceService")))
    from utils.loader_supabase import refresh_projection_cache
    refresh_projection_cache()
    return True


class ProjectionConsumer:
    def __init__(self):
        self.stop_event = threading.Event()
        self.thread = None

    def start(self):
        if os.getenv("AI_USE_PROJECTIONS", "false").lower() != "true":
            return
        self.thread = threading.Thread(target=self._run, name="ai-projection-consumer", daemon=True)
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=5)

    def _run(self):
        while not self.stop_event.is_set():
            try:
                parameters = pika.URLParameters(os.environ["RABBITMQ_URL"])
                connection = pika.BlockingConnection(parameters)
                channel = connection.channel()
                exchange = os.getenv("RABBITMQ_EXCHANGE", "coliving.events")
                dead_letter_exchange = os.getenv("RABBITMQ_DEAD_LETTER_EXCHANGE", f"{exchange}.dlx")
                queue = os.getenv("AI_PROJECTION_QUEUE", "ai-service.projections")
                channel.exchange_declare(exchange=exchange, exchange_type="topic", durable=True)
                channel.exchange_declare(exchange=dead_letter_exchange, exchange_type="topic", durable=True)
                channel.queue_declare(queue=queue, durable=True)
                dead_letter_queue = f"{queue}.dlq"
                channel.queue_declare(queue=dead_letter_queue, durable=True)
                channel.queue_bind(exchange=dead_letter_exchange, queue=dead_letter_queue, routing_key=queue)
                for binding in BINDINGS:
                    channel.queue_bind(exchange=exchange, queue=queue, routing_key=binding)
                channel.basic_qos(prefetch_count=1)
                channel.confirm_delivery()
                for method, properties, body in channel.consume(queue, inactivity_timeout=1):
                    if self.stop_event.is_set():
                        break
                    if method is None:
                        continue
                    try:
                        process_event(json.loads(body.decode("utf-8")))
                        channel.basic_ack(method.delivery_tag)
                    except Exception as error:
                        print(f"[AI] Projection event failed: {error}")
                        headers = dict(properties.headers or {})
                        retries = int(headers.get("x-retry-count", 0))
                        max_retries = int(os.getenv("EVENT_CONSUMER_MAX_RETRIES", "5"))
                        if retries < max_retries:
                            event = json.loads(body.decode("utf-8"))
                            headers["x-retry-count"] = retries + 1
                            channel.basic_publish(
                                exchange=exchange,
                                routing_key=event.get("eventType", method.routing_key),
                                body=body,
                                properties=pika.BasicProperties(
                                    delivery_mode=2, content_type="application/json",
                                    message_id=properties.message_id, type=properties.type,
                                    app_id=properties.app_id, headers=headers,
                                ),
                                mandatory=False,
                            )
                        else:
                            headers.update({
                                "x-retry-count": retries,
                                "x-dead-reason": str(error)[:1000],
                                "x-original-routing-key": method.routing_key,
                            })
                            channel.basic_publish(
                                exchange=dead_letter_exchange,
                                routing_key=queue,
                                body=body,
                                properties=pika.BasicProperties(
                                    delivery_mode=2, content_type="application/json",
                                    message_id=properties.message_id, type=properties.type,
                                    app_id=properties.app_id, headers=headers,
                                ),
                                mandatory=False,
                            )
                        channel.basic_ack(method.delivery_tag)
                channel.cancel()
                connection.close()
            except Exception as error:
                print(f"[AI] Projection consumer reconnecting: {error}")
                self.stop_event.wait(5)
