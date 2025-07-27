import request from 'supertest';
import { useExpressServer, Action } from 'routing-controllers';
import { Container } from 'inversify';
import Express from 'express';
import * as Current from '#root/shared/functions/currentUserChecker.js';
import { faker } from '@faker-js/faker';
import { reportsContainerModules } from '../index.js';
import { beforeAll, describe } from 'vitest';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { useContainer } from 'class-validator';


describe("Report Controller Integration Test",()=>{
    const App = Express();

    beforeAll(async()=> {
        const container = new Container();
        await container.load(...reportsContainerModules);
        const inversifyAdapter = new InversifyAdapter(container);
        useContainer(inversifyAdapter);
    })
})