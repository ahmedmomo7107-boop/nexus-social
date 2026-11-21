import React, { useEffect, useMemo, useState } from 'react';
import { supabase, supabaseReady } from './supabase';
import './style.css';

const MEDIA_BUCKET = 'nexus-media';
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const emptyProfile = {
  username: '',
  display_name: '',
  avatar_url: '',
  bio: '',
};

function PostCard({
  post,
  user,
  isAdmin,
  likes,
  comments,
  commentInputs,
  setCommentInputs,
  getProfile,
  avatar,
  toggleLike,
  reportPost,
  addComment,
  deletePost,
}) {
  const author = getProfile(post.user_id);
  const postLikes = likes.filter((l) => l.post_id === post.id);
  const postComments = comments.filter((c) => c.post_id === post.id);
  const liked = postLikes.some((l) => l.user_id === user?.id);
  const canDelete = Boolean(user && (post.user_id === user.id || isAdmin));

  return (
    <article className="post-card">
      <div className="post-author">
        {avatar(author)}
        <div className="author-info">
          <strong>{author.display_name || author.username}</strong>
          <span>@{author.username}</span>
        </div>
        <span className="post-date">
          {new Date(post.created_at).toLocaleDateString()}
        </span>
      </div>

      {post.content && <p className="post-content">{post.content}</p>}

      {post.media_type === 'image' && post.media_url && (
        <img className="post-media" src={post.media_url} alt="Post media" />
      )}

      {post.media_type === 'video' && post.media_url && (
        <video
          className="post-media"
          src={post.media_url}
          controls
          playsInline
        />
      )}

      <div className="post-actions">
        <button
          className={liked ? 'action active' : 'action'}
          onClick={() => toggleLike(post)}
        >
          ♥ {postLikes.length}
        </button>
        <span className="action">▢ {postComments.length} comments</span>
        <button className="action" onClick={() => reportPost(post)}>
          Report
        </button>
        {canDelete && (
          <button
            type="button"
            className="action"
            onClick={() => deletePost(post)}
          >
            Delete
          </button>
        )}
      </div>

      <div className="comments">
        {postComments.map((comment) => {
          const commentAuthor = getProfile(comment.user_id);
          return (
            <div className="comment" key={comment.id}>
              <strong>
                {commentAuthor.display_name || commentAuthor.username}
              </strong>
              <span>{comment.content}</span>
            </div>
          );
        })}

        <form
          className="comment-form"
          onSubmit={(e) => {
            e.preventDefault();
            addComment(post);
          }}
        >
          <input
            value={commentInputs[post.id] || ''}
            onChange={(e) =>
              setCommentInputs((old) => ({
                ...old,
                [post.id]: e.target.value,
              }))
            }
            placeholder="Write a comment..."
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </article>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(emptyProfile);
  const [profiles, setProfiles] = useState([]);
  const [posts, setPosts] = useState([]);
  const [likes, setLikes] = useState([]);
  const [comments, setComments] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [members, setMembers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [messages, setMessages] = useState([]);
  const [following, setFollowing] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [reports, setReports] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const [page, setPage] = useState('home');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');

  const [postText, setPostText] = useState('');
  const [postFile, setPostFile] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const [search, setSearch] = useState('');
  const [selectedChatId, setSelectedChatId] = useState('');
  const [messageTo, setMessageTo] = useState('');
  const [messageText, setMessageText] = useState('');
  const [communityName, setCommunityName] = useState('');
  const [communityDescription, setCommunityDescription] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [showQuickProfileEdit, setShowQuickProfileEdit] = useState(false);

  const user = session?.user ?? null;

  const say = (message) => {
    setNotice(message);
    setError('');
    window.setTimeout(() => setNotice(''), 3500);
  };

  const fail = (message) => {
    setError(message);
    setNotice('');
  };

  function validateFileSize(file) {
    if (!file) return true;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      fail(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(
          1
        )} MB). Max allowed is ${MAX_FILE_SIZE_MB} MB on the Free plan.`
      );
      return false;
    }
    return true;
  }

  function handleMediaSelection(file, { requireVideo = false } = {}) {
    if (!file) {
      setPostFile(null);
      return;
    }

    if (requireVideo && !file.type.startsWith('video/')) {
      setPostFile(null);
      return fail('Please select a valid video file for Reels.');
    }

    if (!validateFileSize(file)) {
      setPostFile(null);
      return;
    }

    setError('');
    setPostFile(file);
  }

  useEffect(() => {
    if (!supabaseReady || !supabase) {
      setError('Supabase is not configured. Check your environment variables.');
      setLoading(false);
      return;
    }

    let alive = true;

    supabase.auth.getSession().then(({ data, error: authError }) => {
      if (!alive) return;
      if (authError) fail(authError.message);
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      }
    );

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(emptyProfile);
      setPosts([]);
      setLikes([]);
      setComments([]);
      setNotifications([]);
      setMessages([]);
      setFollowing([]);
      setIsAdmin(false);
      return;
    }

    loadEverything();
  }, [user?.id]);

  async function loadEverything() {
    if (!user) return;
    setLoading(true);
    setError('');

    try {
      const results = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('likes').select('*'),
        supabase.from('comments').select('*').order('created_at'),
        supabase
          .from('communities')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('community_members').select('*'),
        supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('messages').select('*').order('created_at'),
        supabase.from('follows').select('*'),
        supabase.from('blocks').select('*').eq('blocker_id', user.id),
        supabase
          .from('nexus_admins')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      const [
        profileResult,
        postResult,
        likeResult,
        commentResult,
        communityResult,
        memberResult,
        notificationResult,
        messageResult,
        followResult,
        blockResult,
        adminResult,
      ] = results;

      const errors = [
        profileResult,
        postResult,
        likeResult,
        commentResult,
        communityResult,
        memberResult,
        notificationResult,
        messageResult,
        followResult,
        blockResult,
      ].filter((r) => r.error);

      if (errors.length) {
        console.error('NEXUS data loading:', errors);
      }

      const allProfiles = profileResult.data || [];
      setProfiles(allProfiles);

      const ownProfile = allProfiles.find((p) => p.id === user.id);
      if (ownProfile) {
        setProfile(ownProfile);
        setEditBio(ownProfile.bio || '');
        setEditDisplayName(ownProfile.display_name || '');
        setEditUsername(ownProfile.username || '');
      } else {
        const fallback = {
          ...emptyProfile,
          display_name: user.email?.split('@')[0] || 'Member',
          username: `member_${user.id.slice(0, 7)}`,
        };
        setProfile(fallback);
        setEditBio('');
        setEditDisplayName(fallback.display_name);
        setEditUsername(fallback.username);
        await supabase.from('profiles').upsert(
          {
            id: user.id,
            ...fallback,
          },
          { onConflict: 'id' }
        );
      }

      setPosts(postResult.data || []);
      setLikes(likeResult.data || []);
      setComments(commentResult.data || []);
      setCommunities(communityResult.data || []);
      setMembers(memberResult.data || []);
      setNotifications(notificationResult.data || []);
      setMessages(messageResult.data || []);
      setFollowing(followResult.data || []);
      setBlocked(blockResult.data || []);
      setIsAdmin(Boolean(adminResult.data));
    } catch (e) {
      fail(e.message || 'Could not load your account.');
    } finally {
      setLoading(false);
    }
  }

  async function signIn(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setBusy(false);
    if (error) fail(error.message);
  }

  async function signUp(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername || !displayName.trim()) {
      setBusy(false);
      return fail('Enter your name and username.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName.trim(),
          username: cleanUsername,
        },
      },
    });

    if (error) {
      setBusy(false);
      return fail(error.message);
    }

    if (data.user && data.session) {
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: data.user.id,
          username: cleanUsername,
          display_name: displayName.trim(),
          avatar_url: '',
          bio: '',
        },
        { onConflict: 'id' }
      );

      if (profileError) fail(profileError.message);
      else say('Your account has been created.');
    } else {
      say('Check your email to confirm your account.');
    }

    setBusy(false);
  }

  async function resetPassword() {
    if (!email) return fail('Enter your email address first.');

    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) fail(error.message);
    else say('Password recovery email sent.');
  }

  async function signOut() {
    await supabase.auth.signOut();
    setPage('home');
  }

  async function uploadFile(file, folder) {
    if (!file || !user) return null;
    if (!validateFileSize(file)) {
      throw new Error(`File exceeds ${MAX_FILE_SIZE_MB} MB limit.`);
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${user.id}/${folder}/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, { upsert: false });

    if (error) throw error;

    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function createPost(event) {
    event.preventDefault();
    if (!user) return fail('Sign in to publish.');
    if (page === 'reels' && !postFile) {
      return fail('Please select a video for your reel.');
    }
    if (!postText.trim() && !postFile) {
      return fail('Write something or select a file.');
    }
    if (postFile && !validateFileSize(postFile)) return;

    setBusy(true);
    try {
      let mediaUrl = null;
      let mediaType = null;

      if (postFile) {
        const folder = page === 'reels' ? 'reels' : 'posts';
        mediaUrl = await uploadFile(postFile, folder);
        mediaType =
          page === 'reels' || postFile.type.startsWith('video/')
            ? 'video'
            : 'image';
      }

      const { data: inserted, error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: postText.trim(),
          media_url: mediaUrl,
          media_type: mediaType,
        })
        .select()
        .single();

      if (error) throw error;

      if (inserted) {
        setPosts((prev) => [inserted, ...prev]);
      }

      setPostText('');
      setPostFile(null);
      say(page === 'reels' ? 'Your reel is live.' : 'Your post is live.');
    } catch (e) {
      console.error('CREATE POST ERROR:', e);
      fail(e?.message || e?.details || 'Failed to publish post.');
    } finally {
      setBusy(false);
    }
  }

  async function deletePost(post) {
    if (!user) return fail('Sign in to delete posts.');
    if (post.user_id !== user.id && !isAdmin) {
      return fail('You can only delete your own posts.');
    }

    const previousPosts = posts;
    setPosts((prev) => prev.filter((item) => item.id !== post.id));

    try {
      await supabase.from('comments').delete().eq('post_id', post.id);
      await supabase.from('likes').delete().eq('post_id', post.id);

      const bucketPrefix = `/object/public/${MEDIA_BUCKET}/`;
      if (post.media_url && post.media_url.includes(bucketPrefix)) {
        const rawPath = post.media_url.split(bucketPrefix)[1]?.split('?')[0];
        if (rawPath) {
          await supabase.storage
            .from(MEDIA_BUCKET)
            .remove([decodeURIComponent(rawPath)]);
        }
      }

      let query = supabase.from('posts').delete().eq('id', post.id);
      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { error } = await query;
      if (error) throw error;

      setComments((prev) => prev.filter((c) => c.post_id !== post.id));
      setLikes((prev) => prev.filter((l) => l.post_id !== post.id));
      say(post.media_type === 'video' ? 'Reel deleted.' : 'Post deleted.');
    } catch (e) {
      console.error('DELETE POST ERROR:', e);
      setPosts(previousPosts);
      fail(e?.message || 'Could not delete post.');
    }
  }

  async function toggleLike(post) {
    if (!user) return fail('Sign in to like posts.');

    const existing = likes.find(
      (item) => item.post_id === post.id && item.user_id === user.id
    );

    if (existing) {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', user.id);

      if (error) return fail(error.message);
    } else {
      const { error } = await supabase.from('likes').insert({
        post_id: post.id,
        user_id: user.id,
      });

      if (error) return fail(error.message);

      if (post.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          actor_id: user.id,
          post_id: post.id,
          type: 'like',
          content: 'liked your post',
        });
      }
    }

    const { data } = await supabase.from('likes').select('*');
    setLikes(data || []);
  }

  async function addComment(post) {
    if (!user) return fail('Sign in to comment.');

    const content = (commentInputs[post.id] || '').trim();
    if (!content) return;

    const { error } = await supabase.from('comments').insert({
      post_id: post.id,
      user_id: user.id,
      content,
    });

    if (error) return fail(error.message);

    if (post.user_id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: post.user_id,
        actor_id: user.id,
        post_id: post.id,
        type: 'comment',
        content: 'commented on your post',
      });
    }

    setCommentInputs((old) => ({ ...old, [post.id]: '' }));
    const { data } = await supabase
      .from('comments')
      .select('*')
      .order('created_at');
    setComments(data || []);
  }

  async function followUser(targetId) {
    if (!user) return fail('Sign in to follow members.');
    if (targetId === user.id) return;

    const existing = following.find(
      (f) => f.follower_id === user.id && f.following_id === targetId
    );

    if (existing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetId);

      if (error) return fail(error.message);
    } else {
      const { error } = await supabase.from('follows').insert({
        follower_id: user.id,
        following_id: targetId,
      });

      if (error) return fail(error.message);

      await supabase.from('notifications').insert({
        user_id: targetId,
        actor_id: user.id,
        type: 'follow',
        content: 'started following you',
      });
    }

    const { data } = await supabase.from('follows').select('*');
    setFollowing(data || []);
  }

  function openChatWithMember(member) {
    setSelectedChatId(member.id);
    setMessageTo(member.username || '');
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!user) return fail('Sign in to send messages.');

    const target =
      profiles.find((p) => p.id === selectedChatId) ||
      profiles.find(
        (p) =>
          p.username?.toLowerCase() ===
          messageTo.trim().replace(/^@/, '').toLowerCase()
      );

    if (!target) return fail('Choose a friend or enter a valid username.');
    if (target.id === user.id) return fail('You cannot message yourself.');
    if (!messageText.trim()) return;

    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: target.id,
      content: messageText.trim(),
      is_read: false,
    });

    if (error) return fail(error.message);

    await supabase.from('notifications').insert({
      user_id: target.id,
      actor_id: user.id,
      type: 'message',
      content: 'sent you a message',
    });

    setSelectedChatId(target.id);
    setMessageTo(target.username || '');
    setMessageText('');
    const { data } = await supabase
      .from('messages')
      .select('*')
      .order('created_at');

    setMessages(data || []);
    say('Message sent.');
  }

  async function createCommunity(event) {
    event.preventDefault();
    if (!user) return fail('Sign in to create a community.');
    if (!communityName.trim()) return;

    const { data, error } = await supabase
      .from('communities')
      .insert({
        name: communityName.trim(),
        description: communityDescription.trim(),
        owner_id: user.id,
      })
      .select()
      .single();

    if (error) return fail(error.message);

    await supabase.from('community_members').insert({
      community_id: String(data.id),
      user_id: user.id,
    });

    setCommunityName('');
    setCommunityDescription('');
    const { data: fresh } = await supabase.from('communities').select('*');
    setCommunities(fresh || []);
    say('Community created.');
  }

  async function joinCommunity(community) {
    if (!user) return fail('Sign in to join communities.');

    const alreadyJoined = members.some(
      (m) =>
        String(m.community_id) === String(community.id) && m.user_id === user.id
    );

    const result = alreadyJoined
      ? await supabase
          .from('community_members')
          .delete()
          .eq('community_id', String(community.id))
          .eq('user_id', user.id)
      : await supabase.from('community_members').insert({
          community_id: String(community.id),
          user_id: user.id,
        });

    if (result.error) return fail(result.error.message);

    const { data } = await supabase.from('community_members').select('*');
    setMembers(data || []);
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!user) return;
    if (avatarFile && !validateFileSize(avatarFile)) return;

    setBusy(true);
    try {
      let avatarUrl = profile.avatar_url || '';

      if (avatarFile) {
        avatarUrl = await uploadFile(avatarFile, 'avatars');
      }

      const updates = {
        id: user.id,
        username: editUsername.trim().toLowerCase(),
        display_name: editDisplayName.trim(),
        bio: editBio.trim(),
        avatar_url: avatarUrl,
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(updates, { onConflict: 'id' });

      if (error) throw error;

      setProfile(updates);
      setAvatarFile(null);
      setShowQuickProfileEdit(false);
      const { data } = await supabase.from('profiles').select('*');
      setProfiles(data || []);
      say('Profile updated.');
    } catch (e) {
      console.error('SAVE PROFILE ERROR:', e);
      fail(e?.message || e?.details || 'Failed to update profile.');
    } finally {
      setBusy(false);
    }
  }

  async function markNotificationRead(notification) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notification.id)
      .eq('user_id', user.id);

    if (error) return fail(error.message);

    setNotifications((old) =>
      old.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
    );
  }

  async function reportPost(post) {
    if (!user) return fail('Sign in to report content.');

    const reason = window.prompt('Why are you reporting this post?');
    if (!reason?.trim()) return;

    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      target_type: 'post',
      target_id: String(post.id),
      reason: reason.trim(),
    });

    if (error) fail(error.message);
    else say('Report submitted.');
  }

  async function blockUser(targetId) {
    if (!user || targetId === user.id) return;

    const { error } = await supabase.from('blocks').insert({
      blocker_id: user.id,
      blocked_id: targetId,
    });

    if (error && !error.message.toLowerCase().includes('duplicate')) {
      return fail(error.message);
    }

    const { data } = await supabase
      .from('blocks')
      .select('*')
      .eq('blocker_id', user.id);

    setBlocked(data || []);
    say('Member blocked.');
  }

  async function loadReports() {
    if (!isAdmin) return fail('Admin access required.');

    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return fail(error.message);
    setReports(data || []);
  }

  async function updateReport(report, status) {
    if (!isAdmin) return fail('Admin access required.');

    const { error } = await supabase
      .from('reports')
      .update({ status })
      .eq('id', report.id);

    if (error) return fail(error.message);
    loadReports();
  }

  const blockedIds = useMemo(
    () => new Set(blocked.map((b) => b.blocked_id)),
    [blocked]
  );

  const visiblePosts = useMemo(
    () => posts.filter((p) => !blockedIds.has(p.user_id)),
    [posts, blockedIds]
  );

  const followingIds = useMemo(
    () =>
      new Set(
        following
          .filter((f) => f.follower_id === user?.id)
          .map((f) => f.following_id)
      ),
    [following, user?.id]
  );

  const friendsOrPeople = useMemo(() => {
    const others = profiles.filter(
      (p) => p.id !== user?.id && !blockedIds.has(p.id)
    );
    const followedFirst = others.filter((p) => followingIds.has(p.id));
    const rest = others.filter((p) => !followingIds.has(p.id));
    return [...followedFirst, ...rest];
  }, [profiles, user?.id, blockedIds, followingIds]);

  const activeChatUser = useMemo(() => {
    if (selectedChatId) {
      return profiles.find((p) => p.id === selectedChatId) || null;
    }
    if (messageTo.trim()) {
      return (
        profiles.find(
          (p) =>
            p.username?.toLowerCase() ===
            messageTo.trim().replace(/^@/, '').toLowerCase()
        ) || null
      );
    }
    return friendsOrPeople[0] || null;
  }, [selectedChatId, messageTo, profiles, friendsOrPeople]);

  const activeChatMessages = useMemo(() => {
    if (!activeChatUser || !user) return [];
    return messages.filter(
      (m) =>
        (m.sender_id === user.id && m.receiver_id === activeChatUser.id) ||
        (m.sender_id === activeChatUser.id && m.receiver_id === user.id)
    );
  }, [messages, activeChatUser, user]);

  const filteredProfiles = profiles.filter(
    (p) =>
      p.id !== user?.id &&
      !blockedIds.has(p.id) &&
      `${p.username} ${p.display_name}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  const myPosts = visiblePosts.filter((p) => p.user_id === user?.id);
  const reels = visiblePosts.filter(
    (p) => p.media_type === 'video' && p.media_url
  );

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  function getProfile(id) {
    return (
      profiles.find((p) => p.id === id) || {
        display_name: 'NEXUS Member',
        username: 'member',
        avatar_url: '',
      }
    );
  }

  function avatar(profileData) {
    if (profileData?.avatar_url) {
      return <img className="avatar" src={profileData.avatar_url} alt="" />;
    }

    return (
      <div className="avatar avatar-fallback">
        {(profileData?.display_name || profileData?.username || 'N')
          .charAt(0)
          .toUpperCase()}
      </div>
    );
  }

  if (!supabaseReady) {
    return (
      <div className="setup-screen">
        <h1>NEXUS</h1>
        <p>Supabase configuration is missing.</p>
        <p>Check your .env file and restart the preview.</p>
      </div>
    );
  }

  if (loading && !session) {
    return <div className="loading-screen">NEXUS</div>;
  }

  if (!user) {
    return (
      <main className="auth-screen">
        <section className="auth-brand">
          <div className="brand-mark">N</div>
          <h1>NEXUS</h1>
          <p>CONNECT BEYOND</p>
        </section>

        <form
          className="auth-card"
          onSubmit={authMode === 'login' ? signIn : signUp}
        >
          <h2>
            {authMode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="muted">Connect with people and communities.</p>

          {authMode === 'signup' && (
            <>
              <label>Display name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                required
              />

              <label>Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                required
              />
            </>
          )}

          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            minLength="6"
            required
          />

          {error && <p className="error">{error}</p>}
          {notice && <p className="success">{notice}</p>}

          <button className="primary-button" disabled={busy}>
            {busy
              ? 'Please wait...'
              : authMode === 'login'
              ? 'Sign In'
              : 'Create Account'}
          </button>

          {authMode === 'login' && (
            <button
              type="button"
              className="text-button"
              onClick={resetPassword}
            >
              Forgot password?
            </button>
          )}

          <div className="auth-switch">
            {authMode === 'login'
              ? "Don't have an account?"
              : 'Already have an account?'}
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setAuthMode(authMode === 'login' ? 'signup' : 'login')
              }
            >
              {authMode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="wordmark" onClick={() => setPage('home')}>
          <span className="brand-mark small">N</span>
          <span>NEXUS</span>
        </button>

        <div className="top-search">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members..."
          />
        </div>

        <div className="top-user">
          {avatar(profile)}
          <button className="text-button" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </header>

      <div className="main-layout">
        <aside className="sidebar">
          <div className="sidebar-profile">
            {avatar(profile)}
            <strong>{profile.display_name || 'Your profile'}</strong>
            <span>@{profile.username}</span>
          </div>

          <nav>
            {[
              ['home', '⌂', 'Home'],
              ['explore', '⌕', 'Explore'],
              ['reels', '▣', 'Reels'],
              ['messages', '✉', 'Messages'],
              ['communities', '◈', 'Communities'],
              [
                'notifications',
                '♧',
                `Notifications${unreadCount ? ` (${unreadCount})` : ''}`,
              ],
              ['profile', '◉', 'My Profile'],
              ['settings', '⚙', 'Settings'],
            ].map(([key, icon, label]) => (
              <button
                key={key}
                className={page === key ? 'nav-item selected' : 'nav-item'}
                onClick={() => {
                  setPostFile(null);
                  setPage(key);
                  if (key === 'admin') loadReports();
                }}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}

            {isAdmin && (
              <button
                className={page === 'admin' ? 'nav-item selected' : 'nav-item'}
                onClick={() => {
                  setPostFile(null);
                  setPage('admin');
                  loadReports();
                }}
              >
                <span>♜</span>Admin Dashboard
              </button>
            )}
          </nav>

          <div className="sidebar-bottom">
            <span>CONNECT BEYOND</span>
            <small>NEXUS Social Platform</small>
          </div>
        </aside>

        <main className="content">
          {(error || notice) && (
            <div className={error ? 'toast error' : 'toast success'}>
              {error || notice}
              <button
                onClick={() => {
                  setError('');
                  setNotice('');
                }}
              >
                ×
              </button>
            </div>
          )}

          {page === 'home' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">YOUR COMMUNITY</span>
                  <h1>Home Feed</h1>
                </div>
                <span className="live-dot">● LIVE</span>
              </div>

              <form className="composer" onSubmit={createPost}>
                <div className="composer-top">
                  {avatar(profile)}
                  <textarea
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    placeholder="What's happening in your world?"
                    rows="3"
                  />
                </div>
                <div className="composer-bottom">
                  <label className="file-label">
                    ＋ Add photo or video (max {MAX_FILE_SIZE_MB} MB)
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) =>
                        handleMediaSelection(e.target.files?.[0] || null)
                      }
                    />
                  </label>
                  <span className="file-name">{postFile?.name || ''}</span>
                  <button className="primary-button compact" disabled={busy}>
                    {busy ? 'Publishing...' : 'Publish'}
                  </button>
                </div>
              </form>

              <div className="feed-list">
                {visiblePosts.length ? (
                  visiblePosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      user={user}
                      isAdmin={isAdmin}
                      likes={likes}
                      comments={comments}
                      commentInputs={commentInputs}
                      setCommentInputs={setCommentInputs}
                      getProfile={getProfile}
                      avatar={avatar}
                      toggleLike={toggleLike}
                      reportPost={reportPost}
                      addComment={addComment}
                      deletePost={deletePost}
                    />
                  ))
                ) : (
                  <div className="empty-state">
                    <h3>Your feed starts here</h3>
                    <p>Share your first post and connect with the community.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {page === 'explore' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">DISCOVER</span>
                  <h1>Explore</h1>
                </div>
              </div>
              <input
                className="wide-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or username..."
              />

              <h3 className="section-title">Videos & Posts</h3>
              <div className="feed-list">
                {visiblePosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    user={user}
                    isAdmin={isAdmin}
                    likes={likes}
                    comments={comments}
                    commentInputs={commentInputs}
                    setCommentInputs={setCommentInputs}
                    getProfile={getProfile}
                    avatar={avatar}
                    toggleLike={toggleLike}
                    reportPost={reportPost}
                    addComment={addComment}
                    deletePost={deletePost}
                  />
                ))}
                {!visiblePosts.length && (
                  <div className="empty-state">
                    <h3>Nothing to explore yet</h3>
                    <p>Posts and videos shared by members will appear here.</p>
                  </div>
                )}
              </div>

              <h3 className="section-title">People</h3>
              <div className="member-grid">
                {filteredProfiles.map((p) => {
                  const isFollowing = following.some(
                    (f) => f.follower_id === user.id && f.following_id === p.id
                  );

                  return (
                    <div className="member-card" key={p.id}>
                      {avatar(p)}
                      <strong>{p.display_name || p.username}</strong>
                      <span>@{p.username}</span>
                      <p>{p.bio || 'NEXUS community member'}</p>
                      <button
                        className="primary-button compact"
                        onClick={() => followUser(p.id)}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>
                      <button
                        className="text-button"
                        onClick={() => blockUser(p.id)}
                      >
                        Block member
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {page === 'reels' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">SHORT VIDEOS</span>
                  <h1>Reels</h1>
                </div>
              </div>

              <form className="composer" onSubmit={createPost}>
                <div className="composer-top">
                  {avatar(profile)}
                  <textarea
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    placeholder="Write a caption for your reel..."
                    rows="2"
                  />
                </div>
                <div className="composer-bottom">
                  <label className="file-label">
                    ＋ Upload reel video (max {MAX_FILE_SIZE_MB} MB)
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) =>
                        handleMediaSelection(e.target.files?.[0] || null, {
                          requireVideo: true,
                        })
                      }
                    />
                  </label>
                  <span className="file-name">{postFile?.name || ''}</span>
                  <button className="primary-button compact" disabled={busy}>
                    {busy ? 'Uploading...' : 'Publish Reel'}
                  </button>
                </div>
              </form>

              <div className="reels-grid">
                {reels.map((post) => {
                  const canDelete = Boolean(
                    user && (post.user_id === user.id || isAdmin)
                  );
                  return (
                    <div className="reel-card" key={post.id}>
                      <video src={post.media_url} controls playsInline />
                      <p>{post.content}</p>
                      <div className="post-actions">
                        <button
                          className="action"
                          onClick={() => toggleLike(post)}
                        >
                          ♥ {likes.filter((l) => l.post_id === post.id).length}
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            className="action"
                            onClick={() => deletePost(post)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!reels.length && (
                  <div className="empty-state">
                    <h3>No reels yet</h3>
                    <p>Upload a video above to see it here.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {page === 'messages' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">DIRECT CHAT</span>
                  <h1>Messages</h1>
                </div>
              </div>

              <div className="settings-card">
                <h3>Friends & People</h3>
                <p className="muted">
                  Tap someone to chat with them like Instagram.
                </p>
                <div className="member-grid">
                  {friendsOrPeople.map((person) => {
                    const isFriend = followingIds.has(person.id);
                    const isSelected = activeChatUser?.id === person.id;
                    return (
                      <div className="member-card" key={person.id}>
                        {avatar(person)}
                        <strong>
                          {person.display_name || person.username}
                        </strong>
                        <span>@{person.username}</span>
                        <small>
                          {isFriend ? 'Friend (Following)' : 'Member'}
                        </small>
                        <button
                          className="primary-button compact"
                          type="button"
                          onClick={() => openChatWithMember(person)}
                        >
                          {isSelected ? 'Chatting' : 'Message'}
                        </button>
                      </div>
                    );
                  })}
                  {!friendsOrPeople.length && (
                    <p className="muted">No other members available yet.</p>
                  )}
                </div>
              </div>

              <div className="settings-card">
                <h3>
                  {activeChatUser
                    ? `Chat with ${
                        activeChatUser.display_name || activeChatUser.username
                      }`
                    : 'Direct Chat'}
                </h3>

                <div className="message-list">
                  {activeChatMessages.map((m) => {
                    const isMine = m.sender_id === user.id;
                    const sender = getProfile(m.sender_id);
                    return (
                      <div className="message-row" key={m.id}>
                        {avatar(sender)}
                        <div>
                          <strong>
                            {isMine
                              ? 'You'
                              : sender.display_name || sender.username}
                          </strong>
                          <p>{m.content}</p>
                          <small>
                            {new Date(m.created_at).toLocaleString()}
                          </small>
                        </div>
                      </div>
                    );
                  })}
                  {!activeChatMessages.length && (
                    <p className="muted">
                      No messages in this chat yet. Say hi!
                    </p>
                  )}
                </div>

                <form
                  className="composer message-composer"
                  onSubmit={sendMessage}
                >
                  <label>Username</label>
                  <input
                    value={messageTo || activeChatUser?.username || ''}
                    onChange={(e) => {
                      setSelectedChatId('');
                      setMessageTo(e.target.value);
                    }}
                    placeholder="Enter username..."
                  />
                  <label>Your message</label>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Write a message..."
                    rows="2"
                  />
                  <button className="primary-button compact">Send</button>
                </form>
              </div>
            </>
          )}

          {page === 'communities' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">GROUPS & INTERESTS</span>
                  <h1>Communities</h1>
                </div>
              </div>

              <div className="settings-card">
                <p className="muted">
                  Communities are groups where people with shared interests join
                  and connect.
                </p>
              </div>

              <form className="composer" onSubmit={createCommunity}>
                <h3>Create a community</h3>
                <input
                  value={communityName}
                  onChange={(e) => setCommunityName(e.target.value)}
                  placeholder="Community name"
                  required
                />
                <textarea
                  value={communityDescription}
                  onChange={(e) => setCommunityDescription(e.target.value)}
                  placeholder="Describe your community..."
                  rows="2"
                />
                <button className="primary-button compact">
                  Create Community
                </button>
              </form>

              <div className="member-grid">
                {communities.map((community) => {
                  const joined = members.some(
                    (m) =>
                      String(m.community_id) === String(community.id) &&
                      m.user_id === user.id
                  );

                  return (
                    <div
                      className="member-card community-card"
                      key={community.id}
                    >
                      <div className="community-icon">◈</div>
                      <strong>{community.name}</strong>
                      <p>{community.description}</p>
                      <small>
                        {
                          members.filter(
                            (m) =>
                              String(m.community_id) === String(community.id)
                          ).length
                        }{' '}
                        members
                      </small>
                      <button
                        className="primary-button compact"
                        onClick={() => joinCommunity(community)}
                      >
                        {joined ? 'Leave Community' : 'Join Community'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {page === 'notifications' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">ACTIVITY ALERTS</span>
                  <h1>Notifications</h1>
                </div>
              </div>

              <div className="settings-card">
                <p className="muted">
                  Alerts appear here when someone likes your post, comments,
                  follows you, or messages you. Tap any item to mark it as read.
                </p>
              </div>

              <div className="notification-list">
                {notifications.map((n) => {
                  const actor = getProfile(n.actor_id);
                  return (
                    <button
                      className={
                        n.is_read
                          ? 'notification-row'
                          : 'notification-row unread'
                      }
                      key={n.id}
                      onClick={() => markNotificationRead(n)}
                    >
                      {avatar(actor)}
                      <div>
                        <strong>{actor.display_name || actor.username}</strong>
                        <p>{n.content || n.type}</p>
                        <small>{new Date(n.created_at).toLocaleString()}</small>
                      </div>
                      {!n.is_read && <span className="notification-dot" />}
                    </button>
                  );
                })}
                {!notifications.length && (
                  <div className="empty-state">No notifications yet.</div>
                )}
              </div>
            </>
          )}

          {page === 'profile' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">YOUR SPACE</span>
                  <h1>My Profile</h1>
                </div>
                <button
                  type="button"
                  className="primary-button compact"
                  onClick={() => setShowQuickProfileEdit((v) => !v)}
                >
                  {showQuickProfileEdit ? 'Close Edit' : 'Edit Profile / Photo'}
                </button>
              </div>

              <section className="profile-hero">
                {avatar(profile)}
                <div>
                  <h2>{profile.display_name}</h2>
                  <span>@{profile.username}</span>
                  <p>{profile.bio}</p>
                </div>
              </section>

              {showQuickProfileEdit && (
                <form className="settings-card" onSubmit={saveProfile}>
                  <h3>Change Profile Photo & Info</h3>
                  <label>Profile photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                  />
                  {avatarFile && (
                    <small className="file-name">
                      Selected: {avatarFile.name}
                    </small>
                  )}

                  <label>Display name</label>
                  <input
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    required
                  />

                  <label>Username</label>
                  <input
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    required
                  />

                  <label>Bio</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    rows="3"
                    placeholder="Tell people about yourself..."
                  />

                  <button className="primary-button" disabled={busy}>
                    {busy ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>
              )}

              <div className="profile-stats">
                <div>
                  <strong>{myPosts.length}</strong>
                  <span>Posts</span>
                </div>
                <div>
                  <strong>
                    {following.filter((f) => f.following_id === user.id).length}
                  </strong>
                  <span>Followers</span>
                </div>
                <div>
                  <strong>
                    {following.filter((f) => f.follower_id === user.id).length}
                  </strong>
                  <span>Following</span>
                </div>
              </div>

              <h2 className="section-title">Your Posts</h2>
              {myPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  user={user}
                  isAdmin={isAdmin}
                  likes={likes}
                  comments={comments}
                  commentInputs={commentInputs}
                  setCommentInputs={setCommentInputs}
                  getProfile={getProfile}
                  avatar={avatar}
                  toggleLike={toggleLike}
                  reportPost={reportPost}
                  addComment={addComment}
                  deletePost={deletePost}
                />
              ))}
              {!myPosts.length && (
                <div className="empty-state">You haven't posted yet.</div>
              )}
            </>
          )}

          {page === 'settings' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">ACCOUNT</span>
                  <h1>Settings</h1>
                </div>
              </div>

              <form className="settings-card" onSubmit={saveProfile}>
                <h2>Edit Profile</h2>
                <label>Display name</label>
                <input
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  required
                />

                <label>Username</label>
                <input
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  required
                />

                <label>Bio</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows="4"
                  placeholder="Tell people about yourself..."
                />

                <label>Profile photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                />

                <button className="primary-button" disabled={busy}>
                  {busy ? 'Saving...' : 'Save Changes'}
                </button>
              </form>

              <div className="settings-card">
                <h2>Account</h2>
                <p className="muted">{user.email}</p>
                <button className="danger-button" onClick={signOut}>
                  Sign Out
                </button>
              </div>
            </>
          )}

          {page === 'admin' && isAdmin && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">MANAGEMENT</span>
                  <h1>Admin Dashboard</h1>
                </div>
              </div>
              <div className="settings-card">
                <h2>Content Reports</h2>
                {reports.map((report) => (
                  <div className="report-row" key={report.id}>
                    <div>
                      <strong>
                        {report.target_type} · {report.status}
                      </strong>
                      <p>{report.reason}</p>
                      <small>Target: {report.target_id}</small>
                    </div>
                    <div className="report-actions">
                      <button onClick={() => updateReport(report, 'reviewed')}>
                        Reviewed
                      </button>
                      <button onClick={() => updateReport(report, 'resolved')}>
                        Resolve
                      </button>
                    </div>
                  </div>
                ))}
                {!reports.length && <p className="muted">No reports found.</p>}
              </div>
            </>
          )}
        </main>

        <aside className="rightbar">
          <div className="right-card">
            <span className="eyebrow">YOUR NETWORK</span>
            <h3>People to discover</h3>
            {filteredProfiles.slice(0, 5).map((p) => (
              <div className="suggestion" key={p.id}>
                {avatar(p)}
                <div>
                  <strong>{p.display_name || p.username}</strong>
                  <span>@{p.username}</span>
                </div>
                <button onClick={() => followUser(p.id)}>＋</button>
              </div>
            ))}
            {!filteredProfiles.length && (
              <p className="muted">New members will appear here.</p>
            )}
          </div>

          <div className="right-card">
            <span className="eyebrow">ABOUT</span>
            <h3>NEXUS</h3>
            <p className="muted">
              A place to connect, share, and build communities.
            </p>
            <strong className="purple-text">CONNECT BEYOND.</strong>
          </div>
        </aside>
      </div>
    </div>
  );
}
