import React from "react"
import { Observable } from "rxjs"
import { useRx } from "./use-rx"
import { OrReactChild } from "@rixio/rxjs-atom-promise/build/rx"

export interface RxIfProps {
	test$: Observable<any>,
	else?: OrReactChild<() => React.ReactNode>,
	negate?: boolean
	children: React.ReactNode
}

export function RxIf({ test$, children, negate, else: not }: RxIfProps): React.ReactElement | null {
	const raw = useRx(test$)

	if (negate && !raw) {
		return <>{children}</>
	} else if (negate) {
		if (typeof not === "function")
			return <>{not()}</>
		else
			return <>{not}</>
	} else if (raw) {
		return <>{children}</>
	} else {
		if (typeof not === "function")
			return <>{not()}</>
		else
			return <>{not}</>
	}
}
