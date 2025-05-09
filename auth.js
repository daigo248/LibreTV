import { v4 as uuidv4 } from 'uuid';

export async function onRequestPost(context) {
    try {
        const { username, password, action, sessionId } = await context.request.json();
        const kv = context.env.LIBRETV_SESSIONS; // KV命名空间

        // 处理登出请求
        if (action === 'logout' && sessionId) {
            const sessionKey = `user_sessions:${username}`;
            const sessionsRaw = await kv.get(sessionKey);
            if (sessionsRaw) {
                let sessions = JSON.parse(sessionsRaw);
                sessions = sessions.filter(s => s.id !== sessionId);
                await kv.put(sessionKey, JSON.stringify(sessions));
            }
            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 处理登录请求
        const usersConfig = context.env.USERS_CONFIG || '';
        const users = usersConfig.split('|').map(userConfig => {
            const [u, p] = userConfig.split(',');
            return { username: u, password: p };
        });

        const isValidUser = users.some(user => 
            user.username === username && user.password === password
        );

        if (!isValidUser) {
            return new Response(JSON.stringify({ 
                success: false, 
                message: '用户名或密码错误' 
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 检查用户会话数量
        const sessionKey = `user_sessions:${username}`;
        let sessions = [];
        const sessionsRaw = await kv.get(sessionKey);
        if (sessionsRaw) {
            sessions = JSON.parse(sessionsRaw);
        }

        // 如果已有3个会话，删除最早的会话
        if (sessions.length >= 3) {
            sessions.sort((a, b) => a.time - b.time);
            sessions.shift();
        }

        // 创建新会话
        const newSession = {
            id: uuidv4(),
            time: Date.now(),
            device: context.request.headers.get('user-agent')
        };
        sessions.push(newSession);
        await kv.put(sessionKey, JSON.stringify(sessions));

        return new Response(JSON.stringify({ 
            success: true,
            username: username,
            sessionId: newSession.id
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            success: false, 
            message: '服务器错误' 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
