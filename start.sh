docker stop bansur-router
docker rm bansur-router
docker build -t bansur-router .
docker run -d --name bansur-router -p 20128:20128 --env-file .env -v bansur-router-data:/app/data bansur-router