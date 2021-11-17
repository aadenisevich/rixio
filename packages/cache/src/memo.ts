import type { Atom } from "@rixio/atom"
import { noop, Observable } from "rxjs"
import { filter, first, map } from "rxjs/operators"
import { MappedSubject } from "./mapped-subject-1"
import { CacheState, createFulfilledCache, idleCache } from "./domain"
import { save } from "./impl"

export interface Memo<T> extends Observable<T> {
	get(force?: boolean): Promise<T>
	set(value: T): void
	modifyIfFulfilled(updateFn: (currentValue: T) => T): void
	clear(): void
	atom: Atom<CacheState<T>>
}

export class MemoImpl<T> extends MappedSubject<CacheState<T>, T> implements Memo<T> {
    private shouldRefetch = false

	constructor(public readonly atom: Atom<CacheState<T>>, private readonly _loader: () => Promise<T>) {
		super(atom)
		this.clear = this.clear.bind(this)
	}

	get(force = false): Promise<T> {
		if (force || this.hasError) {
			this.clear()
		}
		const s = this.atom.get()
		switch (s.status) {
			case "idle":
				save(this._loader(), this.atom).catch(noop)
				break;
			case "fulfilled":
				return Promise.resolve(s.value)
			case "rejected":
				return Promise.reject(s.error)
		}
		return this.atom
			.pipe(
				filter(x => x.status === "fulfilled" || x.status === "rejected"),
				map(x => {
					if (x.status === "fulfilled") {
						return x.value
					}
					if (x.status === "rejected") {
						throw x.error
					}
					throw new Error("Never happen")
				}),
				first()
			)
			.toPromise()
	}

	set(value: T): void {
		this.atom.set(createFulfilledCache(value))
	}

	modifyIfFulfilled(updateFn: (currentValue: T) => T): void {
		this.atom.modify(s => {
			if (s.status === "fulfilled") {
				return {
					...s,
					value: updateFn(s.value),
				}
			}
			return s
		})
	}

	clear(): void {
		this.atom.set(idleCache)
	}

	protected _onValue(x: CacheState<T>) {
		switch (x.status) {
			case "idle":
				save(this._loader(), this.atom).catch(noop)
				break
			case "rejected":
                if (this.shouldRefetch) {
					this.atom.set(idleCache)
                } else {
                    this.error(x.error)
                    this.shouldRefetch = true
                }
				break
			case "fulfilled":
				this.next(x.value)
				break
		}
	}
}
