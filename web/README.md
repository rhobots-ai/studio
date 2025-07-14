# LLM Fine-Tuning Application

A modern, user-friendly web application for fine-tuning Large Language Models (LLMs) with an intuitive interface built using React, TypeScript, and Vite.

## 🚀 Features

### Core Functionality
- **Model Selection**: Choose from various base models (Mistral, TinyLlama, Phi, etc.)
- **Data Upload & Management**: Upload and format training datasets
- **Fine-Tuning Configuration**: Configure hyperparameters and training settings
- **Training Progress Monitoring**: Real-time tracking of fine-tuning progress
- **Model Querying**: Test and interact with your fine-tuned models
- **Model Evaluation**: Comprehensive evaluation tools with metrics and comparisons

### User Interface
- **Modern Design**: Clean, responsive interface with dark/light theme support
- **Interactive Dashboard**: Overview of models, statistics, and quick actions
- **Real-time Updates**: Live progress tracking and notifications
- **Drag & Drop**: Easy file upload with drag-and-drop functionality
- **Responsive Layout**: Works seamlessly on desktop and mobile devices

### Technical Features
- **TypeScript**: Full type safety and better development experience
- **Component Library**: Custom UI components with consistent design
- **State Management**: Efficient state handling with React hooks
- **API Integration**: Seamless backend integration for model operations
- **Performance Optimized**: Fast loading and smooth interactions

## 🛠️ Tech Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Icons**: Lucide React
- **File Upload**: React Dropzone
- **Notifications**: React Hot Toast

## 📋 Prerequisites

Before running this application, make sure you have:

- **Node.js** (version 16 or higher)
- **npm** or **yarn** package manager
- **Git** for version control

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd llm-fine-tuning-app
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### 4. Build for Production
```bash
npm run build
```

## 🏗️ Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── layout/         # Layout components (Header, SideNav, etc.)
│   ├── models/         # Model-related components
│   ├── theme/          # Theme provider and toggle
│   └── ui/             # Base UI components (Button, Card, etc.)
├── pages/              # Application pages/routes
│   ├── evaluate/       # Model evaluation pages
│   ├── Dashboard.tsx   # Main dashboard
│   ├── SelectModel.tsx # Model selection
│   ├── UploadData.tsx  # Data upload
│   ├── ConfigureTuning.tsx # Training configuration
│   ├── TuningProgress.tsx  # Progress monitoring
│   ├── ModelQuery.tsx  # Model testing
│   └── Settings.tsx    # Application settings
├── services/           # API services and utilities
├── config/            # Configuration files
├── utils/             # Utility functions
└── App.tsx            # Main application component
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🌐 Deployment

### Option 1: Static Hosting (Vercel, Netlify)
1. Build the project: `npm run build`
2. Deploy the `dist/` folder to your hosting platform

### Option 2: EC2 with PM2 (Recommended for self-hosting)

#### Prerequisites on EC2:
```bash
# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
npm install -g pm2

# Install serve for static file serving
npm install -g serve
```

#### Deployment Steps:
1. **Upload your project to EC2**
```bash
# Clone or upload your project
git clone <your-repository-url>
cd llm-fine-tuning-app
```

2. **Install dependencies and build**
```bash
npm install
npm run build
```

3. **Create PM2 ecosystem file**
```bash
# Create ecosystem.config.js
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'llm-fine-tuning-app',
    script: 'serve',
    args: '-s dist -l 3000',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
EOF
```

4. **Start with PM2**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

5. **Configure Security Group**
   - Open port 3000 (or 80/443 if using Nginx)
   - Configure your domain's DNS to point to EC2 public IP

#### Optional: Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔗 API Configuration

The application is configured to proxy API requests to the backend server. The API endpoint is configured in `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'https://finetune_engine.deepcite.in',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
      secure: true,
    },
  },
}
```

For production deployment, ensure your backend API is accessible and CORS is properly configured.

## 🎨 Customization

### Theme Configuration
The application supports light and dark themes. Customize colors in `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      primary: {
        // Your primary color palette
      },
      secondary: {
        // Your secondary color palette
      }
    }
  }
}
```

### Adding New Features
1. Create new components in `src/components/`
2. Add new pages in `src/pages/`
3. Update routing in `src/App.tsx`
4. Add API services in `src/services/`

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Kill process on port 3000
   lsof -ti:3000 | xargs kill -9
   ```

2. **Build fails**
   ```bash
   # Clear node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **PM2 process not starting**
   ```bash
   # Check PM2 logs
   pm2 logs llm-fine-tuning-app
   
   # Restart PM2 process
   pm2 restart llm-fine-tuning-app
   ```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and commit: `git commit -m 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation for common solutions

## 🔄 Version History

- **v0.1.0** - Initial release with core fine-tuning functionality
- Features include model selection, data upload, training configuration, and model querying

---

**Built with ❤️ using React, TypeScript, and modern web technologies**
