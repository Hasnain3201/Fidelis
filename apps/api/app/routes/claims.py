from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import AuthContext, get_auth_context, require_role
from app.db.supabase import get_supabase_client_for_user
from app.db.supabase_admin import get_supabase_admin_client
from app.models.schemas import (
    ArtistClaimCreate,
    ArtistClaimRead,
    ClaimReview,
    MyClaimsResponse,
    VenueClaimCreate,
    VenueClaimRead,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Submit claims (authenticated users with matching role)
# ---------------------------------------------------------------------------

@router.post("/venue-claims", status_code=status.HTTP_201_CREATED, response_model=VenueClaimRead)
def create_venue_claim(
    payload: VenueClaimCreate,
    auth: AuthContext = Depends(require_role("venue")),
):
    client = get_supabase_client_for_user(auth.access_token)
    row = {"venue_id": payload.venue_id, "user_id": auth.user_id, "status": "pending"}
    try:
        response = client.table("venue_claims").insert(row).execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Failed to create venue claim (may already exist)",
        )
    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Insert returned no data")
    return rows[0]


@router.post("/artist-claims", status_code=status.HTTP_201_CREATED, response_model=ArtistClaimRead)
def create_artist_claim(
    payload: ArtistClaimCreate,
    auth: AuthContext = Depends(require_role("artist")),
):
    client = get_supabase_client_for_user(auth.access_token)
    row = {"artist_id": payload.artist_id, "user_id": auth.user_id, "status": "pending"}
    try:
        response = client.table("artist_claims").insert(row).execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Failed to create artist claim (may already exist)",
        )
    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Insert returned no data")
    return rows[0]


# ---------------------------------------------------------------------------
# List my claims (any authenticated user)
# ---------------------------------------------------------------------------

@router.get("/mine", response_model=MyClaimsResponse)
def list_my_claims(auth: AuthContext = Depends(get_auth_context)):
    client = get_supabase_client_for_user(auth.access_token)

    venue_claims: list[dict] = []
    artist_claims: list[dict] = []

    try:
        vc_resp = (
            client.table("venue_claims")
            .select("id,venue_id,user_id,status,reviewed_by,reviewed_at,created_at,updated_at")
            .eq("user_id", auth.user_id)
            .order("created_at", desc=True)
            .execute()
        )
        venue_claims = vc_resp.data or []
    except Exception:
        pass

    try:
        ac_resp = (
            client.table("artist_claims")
            .select("id,artist_id,user_id,status,reviewed_by,reviewed_at,created_at,updated_at")
            .eq("user_id", auth.user_id)
            .order("created_at", desc=True)
            .execute()
        )
        artist_claims = ac_resp.data or []
    except Exception:
        pass

    return MyClaimsResponse(venue_claims=venue_claims, artist_claims=artist_claims)


# ---------------------------------------------------------------------------
# Admin review (approve / reject)
# ---------------------------------------------------------------------------

@router.patch("/venue-claims/{claim_id}/review", response_model=VenueClaimRead)
def review_venue_claim(
    claim_id: str,
    payload: ClaimReview,
    auth: AuthContext = Depends(require_role("admin")),
):
    admin = get_supabase_admin_client()
    if admin is None:
        raise HTTPException(status_code=500, detail="Admin client not configured")

    updates = {
        "status": payload.status,
        "reviewed_by": auth.user_id,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        response = admin.table("venue_claims").update(updates).eq("id", claim_id).execute()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to review venue claim")

    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue claim not found")
    return rows[0]


@router.patch("/artist-claims/{claim_id}/review", response_model=ArtistClaimRead)
def review_artist_claim(
    claim_id: str,
    payload: ClaimReview,
    auth: AuthContext = Depends(require_role("admin")),
):
    admin = get_supabase_admin_client()
    if admin is None:
        raise HTTPException(status_code=500, detail="Admin client not configured")

    updates = {
        "status": payload.status,
        "reviewed_by": auth.user_id,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        response = admin.table("artist_claims").update(updates).eq("id", claim_id).execute()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to review artist claim")

    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artist claim not found")
    return rows[0]
