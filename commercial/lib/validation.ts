export function measurement(value:string, max:number, decimals:number):number|null {

 if (!value.trim()) return null;

 const n=Number(value);

 if (!Number.isFinite(n)||n<=0||n>max||Math.abs(n*10**decimals-Math.round(n*10**decimals))>1e-7) throw new Error("Medição fora dos limites ou precisão inválida.");

 return n;

}

export function validDate(value:string):boolean {

 return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;

}

export function validName(value:string,max=160) {return value.trim().length>=2&&value.trim().length<=max;}

