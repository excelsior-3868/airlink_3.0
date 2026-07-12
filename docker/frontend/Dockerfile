# Airlink v3.0 frontend — React + Vite dev image.
# Code is bind-mounted; node_modules lives in a named volume (fast on Windows).
FROM node:20-alpine
WORKDIR /app

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 5173
ENTRYPOINT ["entrypoint.sh"]
CMD ["npm", "run", "dev"]
