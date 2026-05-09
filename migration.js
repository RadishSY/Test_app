// 数据库迁移：添加 type 列到 messages 和 private_messages
// 对于 MySQL 5.x / 8.x 都兼容
require("dotenv").config();
const mysql = require("mysql2/promise");

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "chat_app",
    multipleStatements: true,
  });

  console.log("Connected to database.");

  // 检查 messages 表是否有 type 列
  const [cols1] = await conn.execute("SHOW COLUMNS FROM messages LIKE 'type'");
  if (cols1.length === 0) {
    await conn.execute("ALTER TABLE messages ADD COLUMN `type` VARCHAR(10) DEFAULT 'text' AFTER `text`");
    console.log("  Added type column to messages");
  } else {
    console.log("  type column already exists in messages");
  }

  // 检查 private_messages 表
  const [cols2] = await conn.execute("SHOW COLUMNS FROM private_messages LIKE 'type'");
  if (cols2.length === 0) {
    await conn.execute("ALTER TABLE private_messages ADD COLUMN `type` VARCHAR(10) DEFAULT 'text' AFTER `text`");
    console.log("  Added type column to private_messages");
  } else {
    console.log("  type column already exists in private_messages");
  }

  // 检查 notifications 表
  const [notifTables] = await conn.execute("SHOW TABLES LIKE 'notifications'");
  if (notifTables.length === 0) {
    await conn.execute(`CREATE TABLE notifications (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'system',
      title VARCHAR(200) NOT NULL,
      content TEXT,
      related_user_id INT,
      link VARCHAR(500),
      is_read TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (related_user_id) REFERENCES users(id)
    )`);
    await conn.execute("CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read)");
    await conn.execute("CREATE INDEX idx_notifications_created ON notifications(created_at)");
    console.log("  Created notifications table");
  } else {
    console.log("  notifications table already exists");
  }

  // 检查 users 表是否有 avatar 列
  const [cols3] = await conn.execute("SHOW COLUMNS FROM users LIKE 'avatar'");
  if (cols3.length === 0) {
    await conn.execute("ALTER TABLE users ADD COLUMN `avatar` VARCHAR(500) DEFAULT '' AFTER `avatar_color`");
    await conn.execute("ALTER TABLE users ADD COLUMN `signature` VARCHAR(200) DEFAULT '' AFTER `avatar`");
    await conn.execute("ALTER TABLE users ADD COLUMN `bio` TEXT AFTER `signature`");
    console.log("  Added avatar/signature/bio columns to users");
  } else {
    console.log("  avatar/signature/bio columns already exist in users");
  }

  await conn.end();
  console.log("Migration complete!");
}

run().catch(err => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
