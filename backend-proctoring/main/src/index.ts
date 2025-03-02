import 'reflect-metadata';
import { buildSchema } from 'type-graphql';
import Express from 'express';
import cookieParser from 'cookie-parser';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginLandingPageProductionDefault, ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { appConfig } from '@config/app';
import { resolvers } from 'api/resolvers';
import { Container } from "typedi";

import cors from 'cors';


async function main() {
  const app = Express();
  const port = appConfig.port;
  
  const schema = await buildSchema({
    resolvers,
    // authChecker (if needed)
    container: Container,
  });

  app.use(cookieParser());
  
  // Example home route
  app.get('/', (req, res) => {
    res.send('Hello World');
  });

  const server = new ApolloServer({
    schema,
    plugins: [
      appConfig.isProduction 
        ? ApolloServerPluginLandingPageProductionDefault() 
        : ApolloServerPluginLandingPageLocalDefault({ footer: false }),
    ],
  });

  await server.start();

  app.use(
  '/graphql',
  cors<cors.CorsRequest>(),
  Express.json(),
  expressMiddleware(server),
);

  // Register the Apollo Server middleware for Express

  app.listen(port, () => {
    console.log(`Server running on port ${port}\nURL: http://localhost:${port}/graphql`);
  });
}

main();
