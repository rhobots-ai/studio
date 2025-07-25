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

   <span>Rhobots Studio uses <a href="https://github.com/orgs/rhobots-ai/discussions"><strong>Github Discussions</strong></a>  for Support and Feature Requests.</span>
   <br/>
   <br/>
   <div>
   </div>
</div>

<p align="center">
   <a href="https://github.com/rhobots-ai/studio/blob/main/LICENSE">
   <img src="https://img.shields.io/badge/License-MIT-E11311.svg" alt="MIT License">
   </a>
   <br/>
   <a href="https://discord.gg/bVQrhHDjkY" target="_blank">
      <img src="https://img.shields.io/discord/1394649845205303436?logo=discord&labelColor=%20%235462eb&logoColor=%20%23f5f5f5&color=%20%235462eb"
      alt="chat on Discord">
   </a>
</p>

<h3 align="center">
Rhobots Studio – Fine-Tune. Evaluate. Deploy. All in One Open Platform.
</h3>

Rhobots Studio is an open-source platform for curating datasets, fine-tuning language models, evaluating performance, and running inference—all in one unified interface.
Whether you're a researcher or a developer, Rhobots Studio simplifies and accelerates the entire LLM lifecycle.
Rhobots Studio can be **self-hosted in minutes**.

## 📦 Deploy Rhobots Studio

### Self-Host Rhobots Studio

Run Rhobots Studio on your own machine in 5 minutes using Docker Compose.

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
