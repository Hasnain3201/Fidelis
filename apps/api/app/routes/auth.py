from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.core.auth import require_user_id

from app.db.supabase import get_supabase_client
from app.db.supabase_admin import get_supabase_admin_client

router = APIRouter(prefix="/auth", tags=["auth"])

ALLOWED_PUBLIC_ROLES = {"user", "venue", "artist"}

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    role: str = "user"

@router.get("/me")
def me(user_id: str = Depends(require_user_id)):
    admin = get_supabase_admin_client()
    if admin is None:
        raise HTTPException(status_code=500, detail="Supabase admin client not configured")
    
    response = (
        admin
        .table("profiles")
        .select("id, role, display_name, home_zip")
        .eq("id", user_id)
        .single()
        .execute()
    )

    data = response.data or {}

    return {
        "id": data.get("id", user_id),
        "role": data.get("role", "user"),
        "display_name": data.get("display_name"),
        "home_zip": data.get("home_zip")
    }

@router.post("/signup")
def signup(payload: SignupRequest):
    admin_client = get_supabase_admin_client()
    if admin_client is None:
        raise HTTPException(status_code=500, detail="Supabase admin client not configured")

    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    if payload.role not in ALLOWED_PUBLIC_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    try:
        res = admin_client.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
                "user_metadata": {
                    "display_name": payload.full_name or "",
                    "role": payload.role,
                },
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create auth user: {e}",
        )

    created = getattr(res, "user", None)
    if not created or not getattr(created, "id", None):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase auth user creation returned no user id",
        )

    user_id = created.id

    try:
        insert_payload = {
            "id": user_id,
            "role": payload.role,
            "display_name": payload.full_name or "",
            "home_zip": None,
        }

        admin_client.table("profiles").upsert(insert_payload, on_conflict="id").execute()

    except Exception as e:
        try:
            admin_client.auth.admin.delete_user(user_id)
        except Exception:
            pass

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"User created in auth but failed to create profile row: {e}",
        )

    return {"status": "ok", "user_id": user_id, "email": payload.email}