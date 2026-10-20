docker stop bansur-router
docker rm bansur-router
docker build -t bansur-router .
docker run -d --name bansur-router -p 667:667 --env-file .env -v bansur-router-data:/app/data bansur-router