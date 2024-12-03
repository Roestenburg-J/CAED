# Use the official Node.js image.
FROM node:18-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Use a smaller image for production
FROM node:18-alpine AS runner

# Set the working directory
WORKDIR /app

# Copy the built application and necessary files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

# Expose the port on which the app will run
EXPOSE 3000

# Start the Next.js application
CMD ["npm", "run", "start"]
