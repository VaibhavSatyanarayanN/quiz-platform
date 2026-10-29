import {
  IsArray,
  IsUUID,
} from 'class-validator';

export class SaveAnswerDto {
  @IsArray()
  @IsUUID('4', { each: true })
  optionIds: string[];
}
