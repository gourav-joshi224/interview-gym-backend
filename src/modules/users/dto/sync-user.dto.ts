import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SyncUserDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email!: string;
}
