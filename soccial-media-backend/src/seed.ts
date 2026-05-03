/**
 * Script seed tao tai khoan mac dinh + demo posts
 * Chay: npx ts-node src/seed.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './module/user/user.entity';
import { UserRole } from './common/enum/user-role.enum';
import { UserStatus } from './common/enum/user-status.enum';
import { Post } from './module/post/post.entity';
import { MongoClient } from 'mongodb';

const MARIADB_CONFIG = {
  type: 'mariadb' as const,
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'zalo_app',
  entities: [User],
  synchronize: true,
};

const MONGO_URL = process.env.DATABASE_URL_MONGO || 'mongodb://localhost:27017/zalo_app';

async function seedMariaDB(): Promise<Array<{ userId: number; username: string; fullName: string }>> {
  const AppDataSource = new DataSource(MARIADB_CONFIG);
  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(User);
  const users: Array<{ userId: number; username: string; fullName: string }> = [];

  const adminEmail = 'admin@zchat.local';
  const adminPassword = 'Admin@123';
  let admin = await userRepo.findOne({ where: { email: adminEmail } as any });
  if (!admin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    admin = userRepo.create({
      email: adminEmail,
      password: hashedPassword,
      username: 'admin',
      fullName: 'Quản trị viên ZChat',
      phone: '',
      avatarUrl: '',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
    await userRepo.save(admin);
    console.log('Created ADMIN: ' + adminEmail + ' / ' + adminPassword);
  } else {
    console.log('Admin already exists');
  }
  users.push({ userId: (admin as any).userId, username: 'admin', fullName: 'Quản trị viên ZChat' });

  const userEmail = 'user@zchat.local';
  const userPassword = 'User@123';
  let user = await userRepo.findOne({ where: { email: userEmail } as any });
  if (!user) {
    const hashedPassword = await bcrypt.hash(userPassword, 10);
    user = userRepo.create({
      email: userEmail,
      password: hashedPassword,
      username: 'testuser',
      fullName: 'Nguyễn Văn An',
      phone: '0912345678',
      avatarUrl: '',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    });
    await userRepo.save(user);
    console.log('Created USER: ' + userEmail + ' / ' + userPassword);
  } else {
    console.log('User already exists');
  }
  users.push({ userId: (user as any).userId, username: 'testuser', fullName: 'Nguyễn Văn An' });

  const user2Email = 'user2@zchat.local';
  let user2 = await userRepo.findOne({ where: { email: user2Email } as any });
  if (!user2) {
    const hashedPassword = await bcrypt.hash('User2@123', 10);
    user2 = userRepo.create({
      email: user2Email,
      password: hashedPassword,
      username: 'testuser2',
      fullName: 'Trần Thị Bình',
      phone: '0987654321',
      avatarUrl: '',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    });
    await userRepo.save(user2);
    console.log('Created USER2: user2@zchat.local / User2@123');
  } else {
    console.log('User2 already exists');
  }
  users.push({ userId: (user2 as any).userId, username: 'testuser2', fullName: 'Trần Thị Bình' });

  await AppDataSource.destroy();
  return users;
}

async function seedMongoDB(users: Array<{ userId: number; username: string; fullName: string }>) {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db();

  const postsCollection = db.collection('post');

  const demoPosts = [
    {
      title: 'Chào mừng đến với ZChat!',
      content: 'Chào mọi người! Đây là bài viết đầu tiên trên nền tảng ZChat - mạng xã hội dành cho cộng đồng Việt Nam. Hãy cùng nhau kết nối và chia sẻ những điều thú vị nhé!',
      visibility: 'public',
      mediaUrl: '',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      interacts: [
        { userId: users[1]?.userId || 2, displayName: 'Nguyễn Văn An', avatarUrl: '', interactType: 'like', createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000) },
      ],
      commentCount: 2,
      owner: { userId: users[0]?.userId || 1, displayName: 'Quản trị viên ZChat', avatarUrl: '' },
    },
    {
      title: 'Học lập trình - Bước đầu tiên',
      content: 'Hôm nay mình bắt đầu học React Native và Expo để xây dựng ứng dụng mobile. Thật sự rất thú vị khi thấy code chạy trên điện thoại của mình! Ai có tip gì cho người mới bắt đầu không?',
      visibility: 'public',
      mediaUrl: '',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      interacts: [
        { userId: users[0]?.userId || 1, displayName: 'Quản trị viên ZChat', avatarUrl: '', interactType: 'like', createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000) },
        { userId: users[2]?.userId || 3, displayName: 'Trần Thị Bình', avatarUrl: '', interactType: 'like', createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
      ],
      commentCount: 1,
      owner: { userId: users[1]?.userId || 2, displayName: 'Nguyễn Văn An', avatarUrl: '' },
    },
    {
      title: 'Công nghệ và tương lai',
      content: 'Trí tuệ nhân tạo đang thay đổi cách chúng ta sống và làm việc. Từ chatbot đến xe tự lái, AI đang trở thành một phần không thể thiếu của cuộc sống hiện đại. Bạn nghĩ sao về xu hướng này?',
      visibility: 'public',
      mediaUrl: '',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      interacts: [],
      commentCount: 3,
      owner: { userId: users[2]?.userId || 3, displayName: 'Trần Thị Bình', avatarUrl: '' },
    },
    {
      title: 'Du lịch Việt Nam - Đà Lạt mùa hè',
      content: 'Mùa hè này mình có kế hoạch đến Đà Lạt. Ai đã từng đến đây có thể gợi ý cho mình những địa điểm đẹp và quán cafe ngon không? Rất mong nhận được chia sẻ từ mọi người!',
      visibility: 'public',
      mediaUrl: '',
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      interacts: [
        { userId: users[1]?.userId || 2, displayName: 'Nguyễn Văn An', avatarUrl: '', interactType: 'like', createdAt: new Date(Date.now() - 47 * 60 * 60 * 1000) },
      ],
      commentCount: 0,
      owner: { userId: users[0]?.userId || 1, displayName: 'Quản trị viên ZChat', avatarUrl: '' },
    },
  ];

  for (const postData of demoPosts) {
    const existing = await postsCollection.findOne({ title: postData.title });
    if (!existing) {
      await postsCollection.insertOne(postData as any);
      console.log('Created post: ' + postData.title);
    } else {
      console.log('Post already exists: ' + postData.title);
    }
  }

  await client.close();
  console.log('MongoDB seed completed!');
}

async function seed() {
  console.log('=== Starting seed ===');
  try {
    const users = await seedMariaDB();
    await seedMongoDB(users);
    console.log('=== Seed completed successfully ===');
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
