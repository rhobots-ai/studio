![Studio GitHub Banner](https://rhstudio.s3.ap-south-1.amazonaws.com/images/github-banner.png)

<div align="center">
   <div>
      <h3>
        <a href="https://langfuse.com/blog/2025-06-04-open-sourcing-langfuse-product">
            <strong>Rhobots Is Doubling Down On Open Source</strong>
         </a> <br> <br>
        <strong>Self Host</strong>
      </h3>
   </div>

   <span>Studio uses <a href="https://github.com/orgs/rhobots-ai/discussions"><strong>Github Discussions</strong></a>  for Support and Feature Requests.</span>
   <br/>
   <br/>
   <div>
   </div>
</div>

<p align="center">
   <a href="https://github.com/rhobots-ai/Studio/blob/main/LICENSE">
   <img src="https://img.shields.io/badge/License-MIT-E11311.svg" alt="MIT License">
   </a>
</p>

Studio is an **open source AI Fine Tuning** platform.
From Text to Video—One AI for All Your Research.
It helps you analyze **unstructured data**, extract insights, and collaborate in one powerful workspace. Studio can be **self-hosted in minutes**.

## 📦 Deploy Studio

### Self-Host Studio

Run Studio on your own machine in 5 minutes using Docker Compose.

  ```bash
  # Get a copy of the latest Langfuse repository
  git clone https://github.com/rhobots-ai/studio.git
  cd studio
  
  # Copy .env.example to .env
  cp .env.example .env
  
  # Ensure to add your OPENAI_API_KEY
  vim .env

  # Run the Studio docker compose
  docker compose up
  ```

## ⭐️ Star Us

![star-studio-on-github](https://documentlm.s3.ap-south-1.amazonaws.com/images/github-star.gif)

## 🥇 License

This repository is MIT licensed, except for the `ee` folders. See [LICENSE](LICENSE).
