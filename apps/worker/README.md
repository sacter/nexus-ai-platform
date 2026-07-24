# Nexus AI Platform - Background Worker

基于 BullMQ 的后台任务 Worker 服务。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `REDIS_HOST` | `localhost` | Redis 地址 |
| `REDIS_PORT` | `6379` | Redis 端口 |
| `QUEUE_NAME` | `default` | 队列名称 |

## 开发

```bash
pnpm dev
```

## 构建

```bash
pnpm build
```

## 启动

```bash
pnpm start
```
