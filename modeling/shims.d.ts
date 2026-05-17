declare module 'better-sqlite3' {
  export interface Statement {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  }

  export interface Database {
    exec(sql: string): void;
    close(): void;
    pragma(source: string): unknown;
    prepare(sql: string): Statement;
    transaction<T extends (...args: any[]) => any>(fn: T): T;
  }

  const DatabaseConstructor: new (filename: string) => Database;
  export default DatabaseConstructor;
}
