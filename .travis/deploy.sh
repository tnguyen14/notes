#!/bin/bash
set -e

cd ..

openssl aes-256-cbc -K $encrypted_478daccaf137_key -iv $encrypted_478daccaf137_iv -in .travis/muffin.enc -out .travis/muffin -d
chmod 600 .travis/muffin
echo -e "Host $DEPLOY_HOST\n\tStrictHostKeyChecking no\n" >> ~/.ssh/config
eval "$(ssh-agent -s)" # start the ssh agent
ssh-add .travis/muffin
git remote add deploy $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_URI
git push deploy master
