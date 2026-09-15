import {
    ArrayMinSize,
    IsArray,
    IsUUID,
} from 'class-validator';

export class SaveAnswerDto {
    @IsArray()
    @ArrayMinSize(1)
    @IsUUID('4', { each: true })
    optionIds: string[];
}