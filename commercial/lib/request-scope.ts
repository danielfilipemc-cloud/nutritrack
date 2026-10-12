/** Invalidates responses when the user, tenant or request changes. */
export class RequestScope {
 private version = 0;
 invalidate() { this.version++; }
 begin() { const version = ++this.version; return () => version === this.version; }
}
