# Google Drive Uploader

A modern, responsive Next.js application for uploading files to Google Drive with a seamless authentication experience.

## 🚀 Features

- **Google Drive Integration**: Direct file uploads to Google Drive
- **Drag & Drop**: Intuitive file upload with drag and drop support
- **Authentication**: Secure OAuth 2.0 authentication with Google
- **File Management**: Upload, organize, and manage files in Google Drive
- **Real-time Progress**: Upload progress tracking and status updates

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, SCSS
- **UI Components**: Radix UI, Material-UI, Lucide React Icons
- **Authentication**: Google OAuth 2.0
- **File Handling**: React Dropzone
- **Build Tools**: ESLint, Prettier, Husky

## 📋 Prerequisites

Before running this application, you need:

1. **Node.js** (version 18 or higher)
2. **npm** or **yarn** package manager
3. **Google Cloud Console** project with Google Drive API enabled
4. **Google OAuth 2.0 credentials**

## 🔧 Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd google-drive-upload
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Drive API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client IDs**
5. Configure the OAuth consent screen
6. Set the application type to **Web application**
7. Add authorized redirect URIs:
   - `http://localhost:3000/auth/callback` (for development)
   - `https://yourdomain.com/auth/callback` (for production)

### 4. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
```

### 5. Run the Application

```bash
# Development mode
npm run dev
# or
yarn dev

# Build for production
npm run build
npm start

# Lint and format code
npm run lint
npm run format
```

The application will be available at `http://localhost:3000`

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms

1. Build the application: `npm run build`
2. Set production environment variables
3. Deploy the `.next` folder to your hosting platform

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |
| `GOOGLE_REDIRECT_URI` | OAuth redirect URI | Yes |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Note**: This application requires proper Google Cloud Console setup and OAuth 2.0 credentials to function. Make sure to follow the setup instructions carefully. 