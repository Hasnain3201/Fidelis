from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.db.supabase import get_supabase_client
from app.db.supabase_admin import get_supabase_admin_client
router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    role: str = "user"


@router.post("/login")
def login(payload: LoginRequest):
    client = get_supabase_client()

    if client is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase client not configured"
        )

    try:
        # Basic check from users table
        response = (
            client.table("users")
            .select("id,email,password")
            .eq("email", payload.email)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    user = response.data

    if not user or user["password"] != payload.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    return {
        "message": "Login successful",
        "user_id": user["id"],
        "email": user["email"]
    }

@router.post("/signup")
def signup(payload: SignupRequest):
    admin_client = get_supabase_admin_client()

    try:
        res = admin_client.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": payload.full_name or "",
                    "role": payload.role
                }
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create auth user: {e}"
        )
    
    created = getattr(res, "user", None)
    if not created or not getattr(created, "id", None):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase auth user creation returned no user id"
        )
    
    user_id = created.id

    try:
        db_client = get_supabase_client()
        if db_client is None:
            raise RuntimeError("Supabase DB client not configured")

        insert_payload = {
            "id": user_id,
            "email": payload.email,
            "name": payload.full_name or "",
            "role": payload.role,
        }

        db_client.table("users").insert(insert_payload).execute()
    except Exception as e:
        try:
            admin_client.auth.admin.delete_user(user_id)
        except Exception:
            pass

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"User created in auth but failed to create app user row: {e}",
        )

    return {"status": "ok", "user_id": user_id, "email": payload.email}
