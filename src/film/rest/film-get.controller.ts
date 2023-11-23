/* eslint-disable max-lines */
/*
 * Copyright (C) 2021 - present Juergen Zimmermann, Hochschule Karlsruhe
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
 * Das Modul besteht aus der Controller-Klasse für Lesen an der REST-Schnittstelle.
 * @packageDocumentation
 */

// eslint-disable-next-line max-classes-per-file
import {
    ApiHeader,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiProperty,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import {
    Controller,
    Get,
    Headers,
    HttpStatus,
    Param,
    Query,
    Req,
    Res,
    UseInterceptors,
} from '@nestjs/common';
import {
    FilmReadService,
    type Suchkriterien,
} from '../service/film-read.service.js';
import { Request, Response } from 'express';
import { type Film } from '../entity/film.entity.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.interceptor.js';
import { type Titel } from '../entity/titel.entity.js';
import { getBaseUri } from './getBaseUri.js';
import { getLogger } from '../../logger/logger.js';
import { paths } from '../../config/paths.js';

/** href-Link für HATEOAS */
export interface Link {
    /** href-Link für HATEOAS-Links */
    readonly href: string;
}

/** Links für HATEOAS */
export interface Links {
    /** self-Link */
    readonly self: Link;
    /** Optionaler Linke für list */
    readonly list?: Link;
    /** Optionaler Linke für add */
    readonly add?: Link;
}

/** Typedefinition für ein Titel-Objekt ohne Rückwärtsverweis zum Film */
export type TitelModel = Omit<Titel, 'film' | 'id'>;

/** Film-Objekt mit HATEOAS-Links */
export type FilmModel = Omit<
    Film,
    'schauspielers' | 'aktualisiert' | 'erzeugt' | 'id' | 'titel' | 'version'
> & {
    titel: TitelModel;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _links: Links;
};

/** Film-Objekte mit HATEOAS-Links in einem JSON-Array. */
export interface FilmenModel {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _embedded: {
        filmen: FilmModel[];
    };
}

/**
 * Klasse für `FilmGetController`, um Queries in _OpenAPI_ bzw. Swagger zu
 * formulieren. `FilmController` hat dieselben Properties wie die Basisklasse
 * `Film` - allerdings mit dem Unterschied, dass diese Properties beim Ableiten
 * so überschrieben sind, dass sie auch nicht gesetzt bzw. undefined sein
 * dürfen, damit die Queries flexibel formuliert werden können. Deshalb ist auch
 * immer der zusätzliche Typ undefined erforderlich.
 * Außerdem muss noch `string` statt `Date` verwendet werden, weil es in OpenAPI
 * den Typ Date nicht gibt.
 */
export class FilmQuery implements Suchkriterien {
    @ApiProperty({ required: false })
    declare readonly rating: number;

    @ApiProperty({ required: false })
    declare readonly filmstart: string;

    @ApiProperty({ required: false })
    declare readonly dauer: number;

    @ApiProperty({ required: false })
    declare readonly sprache: string;

    @ApiProperty({ required: false })
    declare readonly direktor: string;

    @ApiProperty({ required: false })
    declare readonly action: string;

    @ApiProperty({ required: false })
    declare readonly horror: string;

    @ApiProperty({ required: false })
    declare readonly romance: string;

    @ApiProperty({ required: false })
    declare readonly titel: string;
}

const APPLICATION_HAL_JSON = 'application/hal+json';

/**
 * Die Controller-Klasse für die Verwaltung von Filmen.
 */
// Decorator in TypeScript, zur Standardisierung in ES vorgeschlagen (stage 3)
// https://devblogs.microsoft.com/typescript/announcing-typescript-5-0-beta/#decorators
// https://github.com/tc39/proposal-decorators
@Controller(paths.rest)
// @UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ResponseTimeInterceptor)
@ApiTags('Film REST-API')
// @ApiBearerAuth()
// Klassen ab ES 2015
export class FilmGetController {
    // readonly in TypeScript, vgl. C#
    // private ab ES 2019
    readonly #service: FilmReadService;

    readonly #logger = getLogger(FilmGetController.name);

    // Dependency Injection (DI) bzw. Constructor Injection
    // constructor(private readonly service: FilmReadService) {}
    // https://github.com/tc39/proposal-type-annotations#omitted-typescript-specific-features-that-generate-code
    constructor(service: FilmReadService) {
        this.#service = service;
    }

    /**
     * Ein Film wird asynchron anhand seiner ID als Pfadparameter gesucht.
     *
     * Falls es ein solchen Film gibt und `If-None-Match` im Request-Header
     * auf die aktuelle Version des Filmes gesetzt war, wird der Statuscode
     * `304` (`Not Modified`) zurückgeliefert. Falls `If-None-Match` nicht
     * gesetzt ist oder eine veraltete Version enthält, wird der gefundene
     * Film im Rumpf des Response als JSON-Datensatz mit Atom-Links für HATEOAS
     * und dem Statuscode `200` (`OK`) zurückgeliefert.
     *
     * Falls es keinen Film zur angegebenen ID gibt, wird der Statuscode `404`
     * (`Not Found`) zurückgeliefert.
     *
     * @param id Pfad-Parameter `id`
     * @param req Request-Objekt von Express mit Pfadparameter, Query-String,
     *            Request-Header und Request-Body.
     * @param version Versionsnummer im Request-Header bei `If-None-Match`
     * @param accept Content-Type bzw. MIME-Type
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    // eslint-disable-next-line max-params
    @Get(':id')
    @ApiOperation({ summary: 'Suche mit der Film-ID' })
    @ApiParam({
        name: 'id',
        description: 'Z.B. 1',
    })
    @ApiHeader({
        name: 'If-None-Match',
        description: 'Header für bedingte GET-Requests, z.B. "0"',
        required: false,
    })
    @ApiOkResponse({ description: 'Der Film wurde gefunden' })
    @ApiNotFoundResponse({ description: 'Kein Film zur ID gefunden' })
    @ApiResponse({
        status: HttpStatus.NOT_MODIFIED,
        description: 'Der Film wurde bereits heruntergeladen',
    })
    async getById(
        @Param('id') idStr: string,
        @Req() req: Request,
        @Headers('If-None-Match') version: string | undefined,
        @Res() res: Response,
    ): Promise<Response<FilmModel | undefined>> {
        this.#logger.debug('getById: idStr=%s, version=%s"', idStr, version);
        const id = Number(idStr);
        if (Number.isNaN(id)) {
            this.#logger.debug('getById: NaN');
            return res.sendStatus(HttpStatus.NOT_FOUND);
        }

        if (req.accepts([APPLICATION_HAL_JSON, 'json', 'html']) === false) {
            this.#logger.debug('getById: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        const film = await this.#service.findById({ id });
        if (this.#logger.isLevelEnabled('debug')) {
            this.#logger.debug('getById(): film=%s', film.toString());
            this.#logger.debug('getById(): titel=%o', film.titel);
        }

        // ETags
        const versionDb = film.version;
        if (version === `"${versionDb}"`) {
            this.#logger.debug('getById: NOT_MODIFIED');
            return res.sendStatus(HttpStatus.NOT_MODIFIED);
        }
        this.#logger.debug('getById: versionDb=%s', versionDb);
        res.header('ETag', `"${versionDb}"`);

        // HATEOAS mit Atom Links und HAL (= Hypertext Application Language)
        const filmModel = this.#toModel(film, req);
        this.#logger.debug('getById: filmModel=%o', filmModel);
        return res.contentType(APPLICATION_HAL_JSON).json(filmModel);
    }

    /**
     * Filmen werden mit Query-Parametern asynchron gesucht. Falls es mindestens
     * einen solchen Film gibt, wird der Statuscode `200` (`OK`) gesetzt. Im Rumpf
     * des Response ist das JSON-Array mit den gefundenen Filmen, die jeweils
     * um Atom-Links für HATEOAS ergänzt sind.
     *
     * Falls es keinen Film zu den Suchkriterien gibt, wird der Statuscode `404`
     * (`Not Found`) gesetzt.
     *
     * Falls es keine Query-Parameter gibt, werden alle Filmen ermittelt.
     *
     * @param query Query-Parameter von Express.
     * @param req Request-Objekt von Express.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    @Get()
    @ApiOperation({ summary: 'Suche mit Suchkriterien' })
    @ApiOkResponse({ description: 'Eine evtl. leere Liste mit Filmen' })
    async get(
        @Query() query: FilmQuery,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<Response<FilmenModel | undefined>> {
        this.#logger.debug('get: query=%o', query);

        if (req.accepts([APPLICATION_HAL_JSON, 'json', 'html']) === false) {
            this.#logger.debug('get: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        const filmen: Film[] = await this.#service.find(query);
        this.#logger.debug('get: %o', filmen);

        // HATEOAS: Atom Links je Film
        const filmenModel = filmen.map((film) =>
            this.#toModel(film, req, false),
        );
        this.#logger.debug('get: filmenModel=%o', filmenModel);

        const result: FilmenModel = { _embedded: { filmen: filmenModel } };
        return res.contentType(APPLICATION_HAL_JSON).json(result).send();
    }

    #toModel(film: Film, req: Request, all = true) {
        const baseUri = getBaseUri(req);
        this.#logger.debug('#toModel: baseUri=%s', baseUri);
        const { id } = film;
        const links = all
            ? {
                  self: { href: `${baseUri}/${id}` },
                  list: { href: `${baseUri}` },
                  add: { href: `${baseUri}` },
              }
            : { self: { href: `${baseUri}/${id}` } };

        this.#logger.debug('#toModel: film=%o, links=%o', film, links);
        const titelModel: TitelModel = {
            titel: film.titel.titel, // eslint-disable-line unicorn/consistent-destructuring
            originaltitel: film.titel.originaltitel ?? 'N/A', // eslint-disable-line unicorn/consistent-destructuring
            serienname: film.titel.serienname ?? 'N/A', // eslint-disable-line unicorn/consistent-destructuring
        };
        /* eslint-disable unicorn/consistent-destructuring */
        const filmModel: FilmModel = {
            rating: film.rating,
            filmstart: film.filmstart,
            dauer: film.dauer,
            sprache: film.sprache,
            direktor: film.direktor,
            genres: film.genres,
            titel: titelModel,
            _links: links,
        };
        /* eslint-enable unicorn/consistent-destructuring */

        return filmModel;
    }
}
/* eslint-enable max-lines */
