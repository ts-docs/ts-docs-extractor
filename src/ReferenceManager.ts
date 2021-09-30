/* eslint-disable @typescript-eslint/no-unused-vars */
import fetch from "got";
import path from "path";
import { ExternalReference, ReferenceManager, ReferenceType, TypeReferenceKinds } from "@ts-docs/extractor";
import ts from "typescript";

export interface LinkedExternalReference {
    name: string,
    link: string
}

export type PackedSearchData = [
    Array<[
        number, // Module ID,
        Array<[string, Array<[string, number, string|undefined]>, Array<[string, number, string|undefined]>, Array<number>]>, // Classes
        Array<[string, Array<string>, Array<number>]>, // Interfaces,
        Array<[string, Array<string>, Array<number>]>, // Enums,
        Array<[string, Array<number>]>, // Types
        Array<[string, Array<number>]>, // Functions
        Array<[string, Array<number>]> // Constants
    ]>,
    Array<string> // Module names
];


export interface PartialModule {
    classes: Map<string, string>,
    interfaces: Map<string, string>,
    enums: Map<string, {
        members: Set<string>,
        path: string
    }>,
    types: Map<string, string>,
    functions: Map<string, string>,
    constants: Map<string, string>
}

export class TsDocsReferenceManager extends ReferenceManager {
    linked: Map<string, {
        modules: Array<PartialModule>,
        link: string
    }>
    linkedCache: Map<string, Map<string, ReferenceType>>
    constructor(externals: Array<ExternalReference>|undefined) {
        super(externals);
        this.linked = new Map();
        this.linkedCache = new Map();
    }

    findExternal(sym: ts.Symbol, source?: string) : ReferenceType|undefined {
        if (!source) return this.findUnnamedExternal(sym);
        const name = sym.name;
        const firstSlash = source.indexOf("/");
        const modName = firstSlash === -1 ? source : source.slice(0, firstSlash);
        if (this.linked.has(modName)) return this.findLinkedExternal(name, modName);
        return super.findExternal(sym, source);
    }

    findLinkedExternal(name: string, modName: string) : ReferenceType|undefined {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const linkedMod = this.linked.get(modName)!;
        for (const mod of linkedMod.modules) {
            const classVal = mod.classes.get(name);
            if (classVal) return { name, link: path.join(linkedMod.link, classVal), kind: TypeReferenceKinds.CLASS };
            const interVal = mod.interfaces.get(name);
            if (interVal) return { name, link: path.join(linkedMod.link, interVal), kind: TypeReferenceKinds.INTERFACE };
            const enumVal = mod.enums.get(name);
            if (enumVal) return { name, link: path.join(linkedMod.link, enumVal.path), kind: TypeReferenceKinds.ENUM };
            const typeVal = mod.types.get(name);
            if (typeVal) return { name, link: path.join(linkedMod.link, typeVal), kind: TypeReferenceKinds.TYPE_ALIAS };
            const constVal = mod.constants.get(name);
            if (constVal) return { name, link: path.join(linkedMod.link, constVal), kind: TypeReferenceKinds.CONSTANT };
            const funVal = mod.functions.get(name);
            if (funVal) return { name, link: path.join(linkedMod.link, funVal), kind: TypeReferenceKinds.FUNCTION };
        }
        return;
    }

    async loadExternalLinkedLibs(libs: Array<LinkedExternalReference>) : Promise<void> {
        for (const lib of libs) {
            const linkedMods: Array<PartialModule> = [];
            try {
                const [modules, moduleNames] = await fetch(path.join(lib.link, "assets/search.json")).json() as PackedSearchData;
                for (const module of modules) {
                    linkedMods.push({
                        classes: new Map(module[1].map(([name, _props, _methods, numPath]) => [name, numPath.map(num => moduleNames[num]).join("/")])),
                        interfaces: new Map(module[2].map(([name, _props, numPath]) => [name, numPath.map(num => moduleNames[num]).join("/")])),
                        enums: new Map(module[3].map(([name, members, numPath]) => [name, {
                            path: numPath.map(num => moduleNames[num]).join("/"),
                            members: new Set(...members)
                        }])),
                        types: new Map(module[4].map(([name, numPath]) => [name, numPath.map(num => moduleNames[num]).join("/")])),
                        functions: new Map(module[5].map(([name, numPath]) => [name, numPath.map(num => moduleNames[num]).join("/")])),
                        constants: new Map(module[6].map(([name, numPath]) => [name, numPath.map(num => moduleNames[num]).join("/")]))
                    });
                }
                this.linked.set(lib.name, { modules: linkedMods, link: lib.link});
            } catch {
                throw new Error(`Couldn't find search.json file for library ${lib.name}`);
            }
        }
    }
}