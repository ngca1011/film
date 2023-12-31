/* eslint-disable @typescript-eslint/no-magic-numbers */
/*
 * Copyright (C) 2023 - present Juergen Zimmermann, Florian Goebel, Hochschule Karlsruhe
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Das Modul besteht aus der Entity-Klasse.
 * @packageDocumentation
 */

import { IsEmail, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Entity-Klasse für Schauspieler ohne TypeORM.
 */
export class SchauspielerDTO {
    @MaxLength(40)
    @ApiProperty({ example: 'Der Vorname', type: String })
    readonly vorname!: string;

    @MaxLength(40)
    @ApiProperty({ example: 'Der Nachname', type: String })
    readonly nachname!: string;

    @MaxLength(20)
    @ApiProperty({ example: 'Männlich', type: String })
    readonly geschlecht!: string;

    @IsEmail()
    @MaxLength(40)
    @ApiProperty({ example: 'example@gmail.com', type: String })
    readonly email!: string;

    @Matches(/^\+?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4,6}$/mu)
    @MaxLength(40)
    @ApiProperty({ example: 'Die Telefonnummer', type: String })
    readonly telefonnummer!: string;
}
/* eslint-enable @typescript-eslint/no-magic-numbers */
