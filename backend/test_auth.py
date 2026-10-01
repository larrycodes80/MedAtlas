"""Run with backend/.venv/Scripts/python backend/test_auth.py."""
import os
import shutil
import tempfile
import gc
from unittest.mock import patch

vault = tempfile.mkdtemp()
try:
    os.environ["DATA_DIR"] = vault
    from fastapi.testclient import TestClient
    from main import app

    profile = {"name": "Offline Tester", "dateOfBirth": "1990-01-01", "password": "correct horse battery"}
    with TestClient(app) as client:
        assert client.get("/api/sources").status_code == 401
        created = client.post("/api/auth/create", json=profile)
        assert created.status_code == 200, created.text
        user_id = created.json()["profile"]["userId"]
        assert user_id.startswith("usr_")
        assert client.get("/api/auth/status").json()["profile"]["userId"] == user_id
        assert client.get("/api/sources").status_code == 200
        assert client.post("/api/auth/logout").status_code == 200
        assert client.get("/api/sources").status_code == 401
        assert client.post("/api/auth/login", json=profile).status_code == 200
        wrong = {**profile, "password": "wrong password"}
        assert client.post("/api/auth/login", json=wrong).status_code == 401
        second = {**profile, "name": "Another Tester"}
        assert client.post("/api/auth/create", json=second).json()["profile"]["userId"] != user_id
        with patch("main.guard", return_value=False) as guard_model:
            responses = [client.post("/api/chat", json={"query": "What does my report say?"}) for _ in range(5)]
            assert [response.status_code for response in responses] == [400, 400, 400, 400, 403]
            assert [response.headers["X-MedAtlas-Guard-Strikes"] for response in responses] == ["1", "2", "3", "4", "5"]
            assert "medically relevant" in responses[-1].json()["detail"]
            assert "blocked" in responses[-1].json()["detail"]
            assert client.post("/api/chat", json={"query": "What does my report say?"}).status_code == 403
            assert guard_model.call_count == 5
        guard = client.get("/api/auth/status").json()["guard"]
        assert guard == {"strikes": 5, "blocked": True}
finally:
    gc.collect()
    shutil.rmtree(vault, ignore_errors=True)

print("Offline create, login, logout, unique-user, and wrong-password checks passed.")
