/**
 * تعیین رمز تازه برای یک کاربر — برای وقتی رمز فراموش یا گم شده.
 *
 * اجرا (روی خود سرور، داخل پوشه سامانه):
 *   npm run set-password -- admin رمز-تازه
 *
 * رمز حداقل ۸ نویسه باشد. سامانه نیازی به خاموش شدن ندارد.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../server/lib/prisma.js';

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error('Usage: npm run set-password -- <username> <new-password>');
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    const all = await prisma.user.findMany({ select: { username: true } });
    console.error(`No user named "${username}". Existing users: ${all.map((u) => u.username).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 12), isActive: true },
  });
  console.log(`OK: password for "${username}" was changed (and the user is active).`);
}

main().finally(() => prisma.$disconnect());
