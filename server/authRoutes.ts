import { Express, Request, Response } from 'express';
import { db } from './db';
import * as schema from '../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

export function registerAuthRoutes(app: Express) {
  // Login com autenticação real usando cookies
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password, rememberMe } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios' });
      }

      const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));

      if (!user) {
        return res.status(401).json({ message: 'Email ou senha incorretos' });
      }

      const senhaValida = await bcrypt.compare(password, user.password);
      if (!senhaValida) {
        return res.status(401).json({ message: 'Email ou senha incorretos' });
      }

      const sessionDuration = rememberMe
        ? 30 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;

      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: sessionDuration
      };

      res.cookie('user_id', user.id.toString(), cookieOptions);
      res.cookie('user_email', user.email, cookieOptions);
      res.cookie('user_role', user.role, cookieOptions);
      res.cookie('remember_me', rememberMe ? 'true' : 'false', cookieOptions);

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          nome: user.nome
        }
      });
    } catch (error) {
      console.error('Erro no login:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Logout com limpeza completa dos cookies
  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.clearCookie('user_id');
    res.clearCookie('user_email');
    res.clearCookie('user_role');
    res.json({ success: true, message: 'Logout realizado com sucesso' });
  });

  // Dados do usuário com verificação via cookies
  app.get('/api/auth/me', async (req: Request, res: Response) => {
    try {
      const userId = req.cookies.user_id;

      if (!userId) {
        return res.status(401).json({ message: 'Não autenticado' });
      }

      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, parseInt(userId)));

      if (!user) {
        return res.status(401).json({ message: 'Usuário não encontrado' });
      }

      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        nome: user.nome
      });
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });
}
