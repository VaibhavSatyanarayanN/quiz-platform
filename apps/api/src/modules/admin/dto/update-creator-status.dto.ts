import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateCreatorStatusDto {
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}
