from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.core.auth import require_user_id
from app.db.supabase_admin import get_supabase_admin_client

router = APIRouter(prefix="/auth", tags=["auth"])

ALLOWED_PUBLIC_ROLES = {"user", "venue", "artist"}


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    role: str = "user"
    email_opt_in: bool = False
    sms_opt_in: bool = False


@router.get("/me")
def me(user_id: str = Depends(require_user_id)):
    admin = get_supabase_admin_client()
    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase admin client is unavailable. Verify SUPABASE_URL/SUPABASE_SECRET_KEY and Python dependencies.",
        )

    response = (
        admin.table("profiles")
        .select("id, role, display_name, home_zip")
        .eq("id", user_id)
        .single()
        .execute()
    )

    data = response.data

    if not data:
        raise HTTPException(status_code=404, detail="Profile not found")

    return data


@router.post("/signup")
def signup(payload: SignupRequest):
    admin = get_supabase_admin_client()
    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase admin client is unavailable. Verify SUPABASE_URL/SUPABASE_SECRET_KEY and Python dependencies.",
        )

    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    if payload.role not in ALLOWED_PUBLIC_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    try:
        res = admin.auth.admin.create_user(
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

    if not created or not created.id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase auth user creation returned no user id",
        )

    user_id = created.id

    try:
        admin.table("profiles").upsert(
            {
                "id": user_id,
                "role": payload.role,
                "display_name": payload.full_name or "",
                "home_zip": None,
                "email_opt_in": payload.email_opt_in,
                "sms_opt_in": payload.sms_opt_in,
            },
            on_conflict="id",
        ).execute()

    except Exception as e:
        try:
            admin.auth.admin.delete_user(user_id)
        except Exception:
            pass

        raise HTTPException(
            status_code=500,
            detail=f"User created in auth but profile creation failed: {e}",
        )

    return {"status": "ok", "user_id": user_id, "email": payload.email}
