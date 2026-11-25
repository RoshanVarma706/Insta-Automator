/**
 * Instagram / Meta Graph API helpers.
 *
 * Covers the full Reels publishing lifecycle:
 *   1. Resolve the IG Business Account from the access token.
 *   2. Create a Reels media container.
 *   3. Poll for processing completion.
 *   4. Publish the finished container.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

// ─── helpers ────────────────────────────────────────────────────────

function qs(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

async function graphGet<T = Record<string, unknown>>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const url = `${GRAPH}${path}?${qs(params)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    throw new Error(
      `Graph API ${data.error.code}: ${data.error.message}`,
    );
  }
  return data as T;
}

async function graphPost<T = Record<string, unknown>>(
  path: string,
  body: Record<string, string>,
): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: qs(body),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(
      `Graph API ${data.error.code}: ${data.error.message}`,
    );
  }
  return data as T;
}

// ─── public API ─────────────────────────────────────────────────────

export type IgUserInfo = {
  igUserId: string;
  username: string;
  pageName: string;
  profilePictureUrl?: string;
};

/**
 * Resolve the Instagram Business / Creator account linked to the token.
 * Flow: token → Facebook Page → linked IG account.
 */
export async function getIgUserId(
  accessToken: string,
): Promise<IgUserInfo> {
  // 1. Fetch Facebook Pages owned by the token.
  const pages = await graphGet<{
    data?: { id: string; name: string }[];
  }>("/me/accounts", {
    access_token: accessToken,
    fields: "id,name",
  });

  if (!pages.data?.length) {
    throw new Error(
      "No Facebook Pages found. The token needs pages_show_list and pages_read_engagement permissions.",
    );
  }

  const page = pages.data[0];

  // 2. Get the IG Business Account linked to the first page.
  const pageDetail = await graphGet<{
    instagram_business_account?: { id: string };
  }>(`/${page.id}`, {
    access_token: accessToken,
    fields: "instagram_business_account",
  });

  const igId = pageDetail.instagram_business_account?.id;
  if (!igId) {
    throw new Error(
      `No Instagram Business Account linked to Page "${page.name}". ` +
        "Connect one in Facebook Page → Settings → Linked accounts.",
    );
  }

  // 3. Fetch the IG username and profile picture.
  const igAccount = await graphGet<{
    username?: string;
    profile_picture_url?: string;
  }>(`/${igId}`, {
    access_token: accessToken,
    fields: "username,profile_picture_url",
  });

  return {
    igUserId: igId,
    username: igAccount.username ?? "unknown",
    pageName: page.name,
    profilePictureUrl: igAccount.profile_picture_url,
  };
}

/**
 * Create a Reels media container.  Instagram begins processing the
 * video asynchronously; poll with `checkContainerStatus` until it
 * reaches FINISHED.
 */
export async function createReelContainer(
  igUserId: string,
  videoUrl: string,
  caption: string,
  accessToken: string,
): Promise<string> {
  const data = await graphPost<{ id: string }>(`/${igUserId}/media`, {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    access_token: accessToken,
  });
  return data.id;
}

export type ContainerStatus = {
  statusCode: string;
  errorMessage?: string;
};

/**
 * Check whether the media container has finished processing.
 * Possible `statusCode` values: IN_PROGRESS | FINISHED | ERROR | EXPIRED.
 */
export async function checkContainerStatus(
  containerId: string,
  accessToken: string,
): Promise<ContainerStatus> {
  const data = await graphGet<{
    status_code?: string;
    status?: { error_message?: string };
  }>(`/${containerId}`, {
    access_token: accessToken,
    fields: "status_code,status",
  });

  return {
    statusCode: data.status_code ?? "UNKNOWN",
    errorMessage: data.status?.error_message,
  };
}

/**
 * Publish a fully-processed container as a live Instagram Reel.
 * Returns the published media ID.
 */
export async function publishReel(
  igUserId: string,
  containerId: string,
  accessToken: string,
): Promise<string> {
  const data = await graphPost<{ id: string }>(
    `/${igUserId}/media_publish`,
    { creation_id: containerId, access_token: accessToken },
  );
  return data.id;
}
