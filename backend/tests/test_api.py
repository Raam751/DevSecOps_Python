import os
os.environ["DATABASE_URL"] = "sqlite:///./test.db"

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import engine, Base
from app import models  # ensure all models are registered with Base

@pytest.fixture(scope="session", autouse=True)
def create_test_tables():
    """Create all tables before the test session and drop them after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


client = TestClient(app)


# --- Health / Root ---

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "UP"}


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["service"] == "HelpHero API"


# --- POST /api/tickets ---

def test_create_ticket_returns_201():
    payload = {
        "subject": "Login page crashes on mobile",
        "description": "Users report white screen after login on iOS Safari.",
        "priority": "HIGH",
        "agent": "Ram Tichkule",
        "category": "TECHNICAL",
    }
    response = client.post("/api/tickets", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["subject"] == "Login page crashes on mobile"
    assert data["priority"] == "HIGH"
    assert data["status"] == "OPEN"
    assert data["category"] == "TECHNICAL"


def test_create_ticket_validation_missing_subject():
    response = client.post("/api/tickets", json={"priority": "LOW"})
    assert response.status_code == 422


# --- GET /api/tickets ---

def test_list_tickets_returns_list():
    response = client.get("/api/tickets")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


# --- GET /api/tickets/{id} ---

def test_get_ticket_by_id():
    create_resp = client.post(
        "/api/tickets",
        json={
            "subject": "Invoice not generated",
            "priority": "MEDIUM",
            "agent": "Ram Tichkule",
            "category": "BILLING",
        },
    )
    assert create_resp.status_code == 201
    ticket_id = create_resp.json()["id"]

    get_resp = client.get(f"/api/tickets/{ticket_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == ticket_id
    assert get_resp.json()["category"] == "BILLING"


def test_get_ticket_not_found():
    response = client.get("/api/tickets/999999")
    assert response.status_code == 404


# --- PUT /api/tickets/{id} ---

def test_update_ticket_status():
    create_resp = client.post(
        "/api/tickets",
        json={
            "subject": "Feature request: dark mode",
            "priority": "LOW",
            "category": "FEATURE_REQUEST",
        },
    )
    ticket_id = create_resp.json()["id"]

    update_resp = client.put(
        f"/api/tickets/{ticket_id}",
        json={"status": "IN_PROGRESS", "agent": "Ram Tichkule"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["status"] == "IN_PROGRESS"
    assert update_resp.json()["agent"] == "Ram Tichkule"


# --- DELETE /api/tickets/{id} ---

def test_delete_ticket():
    create_resp = client.post(
        "/api/tickets",
        json={"subject": "Ticket to be deleted", "priority": "LOW"},
    )
    ticket_id = create_resp.json()["id"]

    delete_resp = client.delete(f"/api/tickets/{ticket_id}")
    assert delete_resp.status_code == 204

    get_resp = client.get(f"/api/tickets/{ticket_id}")
    assert get_resp.status_code == 404


# --- GET /api/tickets/stats ---

def test_stats_endpoint():
    response = client.get("/api/tickets/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "open" in data
    assert "inProgress" in data
    assert "resolved" in data
