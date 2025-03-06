/**
 * @file index.ts
 * @description This file exports all the DTOs used in the auth module.
 * @module auth
 *
 * @author Aditya BMV
 * @organization DLED
 * @license MIT
 * @created 2025-03-06
 */

import "reflect-metadata";
import { Auth } from "firebase-admin/lib/auth/auth";
import {
  Action,
  RoutingControllersOptions
} from "routing-controllers";
import { AuthController } from "./controllers/AuthController";
import { Container } from "typedi";
import { useContainer } from "routing-controllers";
import { IAuthService } from "./interfaces/IAuthService";
import { FirebaseAuthService } from "./services/FirebaseAuthService";

useContainer(Container);

Container.set<IAuthService>("AuthService", new FirebaseAuthService());

export const serviceOptions: RoutingControllersOptions = {
  controllers: [AuthController],
  authorizationChecker: async function (action: Action, roles: string[]) {
		// Use the auth service to check if the user is authorized
		const authService = Container.get<IAuthService>("AuthService");
		const token = action.request.headers["authorization"]?.split(" ")[1];
		if (!token) {
			return false;
		}
		try {
			const user = await authService.verifyToken(token);
			action.request.user = user;

			// Check if the user's roles match the required roles
			if (roles.length > 0 &&
				!roles.some((role) => user.roles.includes(role))) {
				return false;
			}

			return true;
		} catch (error) {
			return false;
		}
	},
};
