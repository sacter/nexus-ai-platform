FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@nexus/web-v2

FROM nginx:alpine
COPY --from=builder /app/apps/web-v2/dist /usr/share/nginx/html
COPY apps/web-v2/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
