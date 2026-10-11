FROM node:22-alpine as builder
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:latest
COPY nginx.conf /etc/nginx
COPY --from=builder /app/dist/windlively/browser /usr/share/nginx/html
