import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Compass,
  Lock,
  MessageCircle,
  MessageSquareText,
  Shield,
  Sparkles,
  Users,
  Video,
  Waves,
} from 'lucide-react'
import styles from './page.module.css'

const features = [
  {
    icon: MessageSquareText,
    title: 'Tin nhắn realtime',
    description: 'Trò chuyện 1-1, nhóm bạn bè và cộng đồng với tốc độ phản hồi tức thì.',
  },
  {
    icon: Users,
    title: 'Cộng đồng riêng',
    description: 'Tạo nhóm theo sở thích, học tập, công việc hoặc cộng đồng cá nhân.',
  },
  {
    icon: Compass,
    title: 'Khám phá thông minh',
    description: 'Gợi ý nội dung, bạn bè và xu hướng phù hợp với sở thích của bạn.',
  },
  {
    icon: Shield,
    title: 'An toàn & riêng tư',
    description: 'Bảo vệ tài khoản, kiểm duyệt nội dung và hạn chế spam hiệu quả.',
  },
]

const conversations = [
  {
    name: 'Minh Anh',
    message: 'Tối nay họp nhóm ZChat nha!',
    time: '2 phút',
    active: true,
  },
  {
    name: 'Nhóm UI/UX',
    message: 'Đã gửi bản thiết kế mới.',
    time: '12 phút',
    active: false,
  },
  {
    name: 'Cộng đồng React',
    message: 'Có ai dùng Vite không?',
    time: '25 phút',
    active: true,
  },
]

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.heroSection}>
        <div className={styles.blurOne} />
        <div className={styles.blurTwo} />

        <div className={styles.container}>
          <div className={styles.heroPanel}>
            <div className={styles.heroContent}>
              <span className={styles.badge}>
                <Sparkles size={16} />
                ZChat - kết nối cộng đồng Việt
              </span>

              <h1 className={styles.heroTitle}>
                Trò chuyện nhanh hơn,
                <br />
                <span>kết nối gần hơn</span>
                <br />
                mỗi ngày.
              </h1>

              <p className={styles.heroDescription}>
                ZChat mang đến trải nghiệm nhắn tin, kết bạn và xây dựng cộng đồng hiện đại,
                mượt mà, an toàn và dễ sử dụng trên mọi thiết bị.
              </p>

              <div className={styles.heroActions}>
                <Link to="/auth/signup" className={styles.primaryBtn}>
                  Tạo tài khoản miễn phí
                  <ArrowRight size={18} />
                </Link>

                <Link to="/auth/login" className={styles.secondaryBtn}>
                  Đăng nhập
                </Link>
              </div>

              <div className={styles.metricsRow}>
                <div>
                  <strong>120K+</strong>
                  <span>Người dùng</span>
                </div>
                <div>
                  <strong>1.2M+</strong>
                  <span>Tin nhắn/ngày</span>
                </div>
                <div>
                  <strong>99.9%</strong>
                  <span>Ổn định</span>
                </div>
              </div>
            </div>

            <div className={styles.heroPreview}>
              <div className={styles.phoneMockup}>
                <div className={styles.phoneHeader}>
                  <div>
                    <p>ZChat</p>
                    <span>Đang hoạt động</span>
                  </div>
                  <Bell size={20} />
                </div>

                <div className={styles.storyRow}>
                  <div className={styles.storyItem}>A</div>
                  <div className={styles.storyItem}>K</div>
                  <div className={styles.storyItem}>M</div>
                  <div className={styles.storyItem}>T</div>
                </div>

                <div className={styles.chatList}>
                  {conversations.map((item) => (
                    <div className={styles.chatItem} key={item.name}>
                      <div className={styles.avatarWrapper}>
                        <div className={styles.avatar}>{item.name.charAt(0)}</div>
                        {item.active && <span className={styles.onlineDot} />}
                      </div>

                      <div className={styles.chatInfo}>
                        <h4>{item.name}</h4>
                        <p>{item.message}</p>
                      </div>

                      <span className={styles.chatTime}>{item.time}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.messageBox}>
                  <div className={styles.messageLeft}>Chào bạn 👋</div>
                  <div className={styles.messageRight}>ZChat nhìn xịn quá!</div>
                  <div className={styles.typing}>
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>

              <div className={styles.floatCardOne}>
                <MessageCircle size={22} />
                <div>
                  <strong>24K</strong>
                  <span>Tin nhắn mới</span>
                </div>
              </div>

              <div className={styles.floatCardTwo}>
                <CheckCircle2 size={22} />
                <div>
                  <strong>Bảo mật</strong>
                  <span>Xác thực an toàn</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.featuresSection}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionBadge}>
              <Waves size={16} />
              Tính năng nổi bật
            </span>

            <h2>Nền tảng giao tiếp dành cho thế hệ mới</h2>

            <p>
              Mọi thứ bạn cần để nhắn tin, chia sẻ, gọi video và xây dựng cộng đồng đều có trong ZChat.
            </p>
          </div>

          <div className={styles.featureGrid}>
            {features.map((feature) => (
              <article className={styles.featureCard} key={feature.title}>
                <div className={styles.featureIconBox}>
                  <feature.icon size={24} />
                </div>

                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.showcaseSection}>
        <div className={styles.container}>
          <div className={styles.showcasePanel}>
            <div className={styles.showcaseContent}>
              <span className={styles.badge}>
                <Lock size={16} />
                Riêng tư theo cách của bạn
              </span>

              <h2>Kết nối thoải mái, kiểm soát dễ dàng.</h2>

              <p>
                Tùy chỉnh quyền riêng tư, quản lý nhóm, bật tắt thông báo và bảo vệ tài khoản
                chỉ trong vài thao tác đơn giản.
              </p>

              <div className={styles.checkList}>
                <div>
                  <CheckCircle2 size={18} />
                  Nhắn tin cá nhân và nhóm
                </div>
                <div>
                  <CheckCircle2 size={18} />
                  Gọi video chất lượng cao
                </div>
                <div>
                  <CheckCircle2 size={18} />
                  Kiểm soát quyền riêng tư
                </div>
              </div>
            </div>

            <div className={styles.showcaseCards}>
              <div className={styles.showcaseCard}>
                <Video size={26} />
                <h3>Video call</h3>
                <p>Gọi nhanh, hình ảnh rõ nét.</p>
              </div>

              <div className={styles.showcaseCard}>
                <Users size={26} />
                <h3>Nhóm cộng đồng</h3>
                <p>Quản lý thành viên dễ dàng.</p>
              </div>

              <div className={styles.showcaseCard}>
                <Shield size={26} />
                <h3>An toàn</h3>
                <p>Bảo vệ dữ liệu người dùng.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <div className={styles.ctaPanel}>
            <span className={styles.ctaIcon}>
              <Sparkles size={22} />
            </span>

            <h2>Sẵn sàng bắt đầu với ZChat?</h2>

            <p>
              Tạo tài khoản miễn phí và trải nghiệm không gian trò chuyện hiện đại ngay hôm nay.
            </p>

            <Link to="/auth/signup" className={styles.primaryBtn}>
              Bắt đầu ngay
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}