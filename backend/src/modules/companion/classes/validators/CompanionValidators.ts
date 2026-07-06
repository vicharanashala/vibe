import {IsIn, IsString} from 'class-validator';
import {CompanionAnimal} from '../interfaces.js';

export class SelectAnimalBody {
  @IsString()
  @IsIn(['panda', 'fox', 'penguin', 'dog', 'cat'])
  animal!: CompanionAnimal;
}