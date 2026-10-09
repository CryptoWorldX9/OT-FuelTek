FROM node:22-bookworm-slim
WORKDIR /app
COPY automation/package*.json ./automation/
RUN cd automation && npm ci --omit=dev && npm cache clean --force
COPY vendor/pdf-lib.min.js ./vendor/pdf-lib.min.js
COPY settings.js stamp.js receipt.js receipt-pdf.js logo-fueltek.png ./
COPY automation/*.cjs ./automation/
ENV HOST=0.0.0.0 PORT=8080 TZ=America/Santiago NODE_ENV=production
USER node
EXPOSE 8080
CMD ["node", "automation/server.cjs"]
