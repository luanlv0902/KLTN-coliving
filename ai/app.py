import os
import json
import time
import uuid
from collections import defaultdict
from threading import Lock
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse

from services.landlord_scoring import evaluate_user_for_landlord
from services.recommend import recommend_rooms
from services.room_user_similarity import get_detailed_compatibility
from services.roommate import match_roommates
from services.projection_consumer import ProjectionConsumer
from services.projection_reconciliation import ProjectionReconciliationScheduler

load_dotenv()

NP_BOOL_TYPES = tuple(
    value
    for value in (getattr(np, "bool_", None), getattr(np, "bool8", None))
    if value is not None
)


def convert_to_native_types(obj):
    """Convert numpy and pandas-adjacent values to JSON-safe Python values."""
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    if isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    if NP_BOOL_TYPES and isinstance(obj, NP_BOOL_TYPES):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, dict):
        return {key: convert_to_native_types(value) for key, value in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [convert_to_native_types(item) for item in obj]
    return obj


def dataframe_records(result):
    if result is None:
        return []
    if hasattr(result, "to_dict"):
        return [
            convert_to_native_types(record)
            for record in result.to_dict(orient="records")
        ]
    if isinstance(result, list):
        return convert_to_native_types(result)
    return []


def success(data):
    return {"success": True, "data": convert_to_native_types(data), "error": None}


def failure(message, status_code=500, data=None):
    return {
        "success": False,
        "data": [] if data is None else convert_to_native_types(data),
        "error": message,
        "statusCode": status_code,
    }


app = FastAPI(
    title="Room Recommendation API",
    description="AI-powered room matching with real feature engineering",
    version="1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

metrics_lock = Lock()
request_counts = defaultdict(int)
request_durations = defaultdict(lambda: {"count": 0, "sum": 0.0})
requests_in_flight = 0
process_started_at = time.time()


@app.middleware("http")
async def observe_request(request: Request, call_next):
    global requests_in_flight
    correlation_id = request.headers.get("x-correlation-id") or str(uuid.uuid4())
    started = time.perf_counter()
    with metrics_lock:
        requests_in_flight += 1
    expected_token = os.getenv("INTERNAL_SERVICE_TOKEN", "").strip()
    public_paths = {"/health", "/metrics"}
    if (
        expected_token
        and request.url.path not in public_paths
        and request.headers.get("x-internal-service-token", "") != expected_token
    ):
        response = JSONResponse(
            status_code=401,
            content={
                "error": "UNAUTHORIZED_SERVICE",
                "message": "Invalid internal service credentials",
            },
        )
        duration = time.perf_counter() - started
        with metrics_lock:
            requests_in_flight -= 1
            request_counts[(request.method, request.url.path, 401)] += 1
            metric = request_durations[(request.method, request.url.path, 401)]
            metric["count"] += 1
            metric["sum"] += duration
        response.headers["x-correlation-id"] = correlation_id
        return response
    try:
        response = await call_next(request)
    except Exception:
        duration = time.perf_counter() - started
        with metrics_lock:
            requests_in_flight -= 1
            request_counts[(request.method, request.url.path, 500)] += 1
            metric = request_durations[(request.method, request.url.path, 500)]
            metric["count"] += 1
            metric["sum"] += duration
        print(json.dumps({
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "level": "error",
            "service": "ai-service",
            "correlationId": correlation_id,
            "method": request.method,
            "path": request.url.path,
            "status": 500,
            "durationMs": round(duration * 1000),
        }), flush=True)
        raise

    duration = time.perf_counter() - started
    status = response.status_code
    with metrics_lock:
        requests_in_flight -= 1
        request_counts[(request.method, request.url.path, status)] += 1
        metric = request_durations[(request.method, request.url.path, status)]
        metric["count"] += 1
        metric["sum"] += duration
    response.headers["x-correlation-id"] = correlation_id
    if request.url.path != "/metrics":
        print(json.dumps({
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "level": "error" if status >= 500 else "info",
            "service": "ai-service",
            "correlationId": correlation_id,
            "method": request.method,
            "path": request.url.path,
            "status": status,
            "durationMs": round(duration * 1000),
        }), flush=True)
    return response


def metric_labels(method, path, status):
    safe_path = path.replace('\\', '\\\\').replace('"', '\\"').replace("\n", "\\n")
    return f'service="ai-service",method="{method}",path="{safe_path}",status="{status}"'


@app.get("/metrics", response_class=PlainTextResponse)
def metrics():
    with metrics_lock:
        lines = [
            "# HELP coliving_service_info Static service information.",
            "# TYPE coliving_service_info gauge",
            'coliving_service_info{service="ai-service"} 1',
            "# HELP process_uptime_seconds Service process uptime.",
            "# TYPE process_uptime_seconds gauge",
            f'process_uptime_seconds{{service="ai-service"}} {time.time() - process_started_at}',
            "# HELP http_requests_in_flight Current HTTP requests in flight.",
            "# TYPE http_requests_in_flight gauge",
            f'http_requests_in_flight{{service="ai-service"}} {requests_in_flight}',
            "# HELP http_requests_total Total completed HTTP requests.",
            "# TYPE http_requests_total counter",
        ]
        for key, count in request_counts.items():
            lines.append(f"http_requests_total{{{metric_labels(*key)}}} {count}")
        lines.extend([
            "# HELP http_request_duration_seconds HTTP request duration.",
            "# TYPE http_request_duration_seconds summary",
        ])
        for key, value in request_durations.items():
            labels = metric_labels(*key)
            lines.append(f'http_request_duration_seconds_sum{{{labels}}} {value["sum"]}')
            lines.append(f'http_request_duration_seconds_count{{{labels}}} {value["count"]}')
    return "\n".join(lines) + "\n"

projection_consumer = ProjectionConsumer()
projection_reconciliation = ProjectionReconciliationScheduler()

@app.on_event("startup")
def start_projection_consumer():
    projection_consumer.start()
    if os.getenv("AI_ENABLE_RECONCILIATION_SCHEDULER", "true").lower() == "true":
        projection_reconciliation.start()

@app.on_event("shutdown")
def stop_projection_consumer():
    projection_reconciliation.stop()
    projection_consumer.stop()


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "ai-service",
        "dataSource": (
            "ai-projections"
            if os.getenv("AI_USE_PROJECTIONS", "false").lower() == "true"
            else "service-schemas"
            if os.getenv("USE_SERVICE_SCHEMAS", "false").lower() == "true"
            else "legacy-public"
        ),
        "model": "xgboost_retrained_with_real_features",
        "reconciliation": projection_reconciliation.snapshot(),
        "version": "1.0",
    }


@app.get("/recommend-room/{userId}")
def recommend(userId: str, top_k: int = 10):
    try:
        return dataframe_records(recommend_rooms(userId=userId, top_k=top_k))
    except Exception as error:
        print(f"[AI] recommend-room failed for user {userId}: {error}")
        return []


@app.get("/v1/recommend-room/{userId}")
def recommend_v1(userId: str, top_k: int = 10):
    try:
        return success(dataframe_records(recommend_rooms(userId=userId, top_k=top_k)))
    except Exception as error:
        print(f"[AI] v1 recommend-room failed for user {userId}: {error}")
        return failure(str(error), data=[])


@app.get("/match-roommates/{userId}/{roomId}")
def roommate_matching(userId: str, roomId: str):
    try:
        return dataframe_records(match_roommates(userId=userId, roomId=roomId))
    except Exception as error:
        print(f"[AI] match-roommates failed for user {userId}, room {roomId}: {error}")
        return []


@app.get("/v1/match-roommates/{userId}/{roomId}")
def roommate_matching_v1(userId: str, roomId: str):
    try:
        return success(dataframe_records(match_roommates(userId=userId, roomId=roomId)))
    except Exception as error:
        print(f"[AI] v1 match-roommates failed for user {userId}, room {roomId}: {error}")
        return failure(str(error), data=[])


@app.get("/compatibility-detail/{userId}/{roomId}")
def get_compatibility_detail(userId: str, roomId: str):
    result = get_detailed_compatibility(userId, roomId)
    if "error" in result and len(result) <= 2:
        raise HTTPException(status_code=404, detail=result.get("error"))
    return convert_to_native_types(result)


@app.get("/v1/compatibility-detail/{userId}/{roomId}")
def get_compatibility_detail_v1(userId: str, roomId: str):
    result = get_detailed_compatibility(userId, roomId)
    if "error" in result:
        status_code = 404 if len(result) <= 2 else 200
        return failure(result.get("error"), status_code=status_code, data=result)
    return success(result)


@app.get("/landlord/evaluate-applicant/{userId}/{roomId}")
def landlord_evaluate_applicant(userId: str, roomId: str):
    try:
        return convert_to_native_types(
            evaluate_user_for_landlord(userId=userId, roomId=roomId)
        )
    except Exception as error:
        print(f"[AI] landlord evaluate failed for user {userId}, room {roomId}: {error}")
        raise HTTPException(status_code=500, detail="Cannot evaluate applicant")


@app.get("/v1/landlord/evaluate-applicant/{userId}/{roomId}")
def landlord_evaluate_applicant_v1(userId: str, roomId: str):
    try:
        return success(evaluate_user_for_landlord(userId=userId, roomId=roomId))
    except Exception as error:
        print(f"[AI] v1 landlord evaluate failed for user {userId}, room {roomId}: {error}")
        return failure(str(error))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
