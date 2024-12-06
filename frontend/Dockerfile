# Use the official Node.js image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy only the package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the application code
COPY . .

# Expose the development server port
EXPOSE 3000

# Start the Next.js development server
CMD ["npm", "run", "dev"]
