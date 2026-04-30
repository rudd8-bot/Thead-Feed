export default async function handler(req, res) {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "username 필요" });

  const token = process.env.THREADS_ACCESS_TOKEN;
  const userId = process.env.THREADS_USER_ID;

  try {
    const postsRes = await fetch(
      `https://graph.threads.net/v1.0/${userId}/threads?fields=id,text,timestamp,permalink&limit=20&access_token=${token}`
    );
    const postsData = await postsRes.json();
    if (postsData.error) throw new Error(postsData.error.message);

    res.status(200).json({ posts: postsData.data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
