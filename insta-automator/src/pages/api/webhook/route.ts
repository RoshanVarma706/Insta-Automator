import { NextResponse } from "next/server";

const MOCK_VIDEOS = [
  {
    id: "1",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: "Sample YouTube Video - Funny Cats",
    channel: "CatLover99",
    duration: "3:45",
    thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  },
  {
    id: "2",
    url: "https://www.instagram.com/reels/ABC123/",
    title: "Sample IG Reel - Dance Trend",
    channel: "dancer_pro",
    duration: "1:22",
    thumbnail: "https://igcdn-photos-a.ftcdn.net/v/t51.29367-267/sh0.08/e35/91/30/239357563_1234567890_reel_x.jpg",
  },
];

export async function GET(
  request: Request,
  { params }: { params: { source: string } }
) {
  const source = params?.source;
  const url = new URL(request.url).searchParams.get("source");

  if (url && url === "mock") {
    return NextResponse.json({
      success: true, mode: "mock",
      message: "Running without API keys - using sample data",
      videos: MOCK_VIDEOS,
    });
  }

  const video = MOCK_VIDEOS.find(
    v => (source === "youtube" && v.url.includes("youtube.com")) ||
      (source === "instagram" && v.url.includes("instagram.com"))
  );

  if (video) {
    return NextResponse.json({
      success: true, mode: "mock", platform: source, video,
    });
  }
  return NextResponse.json(
    { success: false, error: "Source not found" },
    { status: 404 }
  );
}

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();
    const { url, source } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: "URL is required" },
        { status: 400 }
      );
    }

    const processingSteps = [
      "🔍 Detecting source platform...",
      "📝 Generating caption & hashtags (Gemini mock)...",
      "📐 Transforming to 9:16 (Cloudinary mock)...",
      "📤 Preparing Instagram media...",
      "📱 Publishing to Instagram...",
    ];

    const stepsCompleted = Math.floor(Math.random() * processingSteps.length) + 1;
    const status = stepsCompleted <= 5 ? "processing" : "completed";

    const mockResult = {
      success: true, mode: "mock", source, url,
      status,
      steps: processingSteps.slice(0, stepsCompleted),
      result: status === "completed"
        ? {
            clipId: `clip_${Date.now()}`,
            caption: "Just had the best day ever! 🌟 #fun #happy #viral",
            hashtags: ["#fun", "#happy", "#viral", "#reels", "#trending"],
            cloudinaryUrl: `https://res.cloudinary.com/demo/video/upload/sample_${Date.now()}.mp4`,
            igMediaId: `ig_${Date.now()}`,
          }
        : null,
    };

    return NextResponse.json(mockResult);
  } catch (e) {
    console.error("Webhook error:", e);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}