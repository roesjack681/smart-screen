# 秩渐科技管理系统 — 前端镜像（构建 + Nginx）
FROM node:20-alpine AS builder

WORKDIR /app

# 生产环境通过 Nginx 同源反代，浏览器只访问同一域名
ARG VITE_API_BASE_URL=/api

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
