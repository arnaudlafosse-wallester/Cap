"use client";

import { classNames } from "@cap/utils";
import * as CheckboxPrimitives from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import * as React from "react";

const Checkbox = React.forwardRef<
	React.ElementRef<typeof CheckboxPrimitives.Root>,
	React.ComponentPropsWithoutRef<typeof CheckboxPrimitives.Root>
>(({ className, ...props }, ref) => (
	<CheckboxPrimitives.Root
		ref={ref}
		className={classNames(
			"peer h-4 w-4 shrink-0 rounded border border-gray-6 bg-gray-1",
			"focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
			"disabled:cursor-not-allowed disabled:opacity-50",
			"data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500",
			"transition-colors cursor-pointer",
			className,
		)}
		{...props}
	>
		<CheckboxPrimitives.Indicator className="flex items-center justify-center text-white">
			<Check className="size-3" />
		</CheckboxPrimitives.Indicator>
	</CheckboxPrimitives.Root>
));
Checkbox.displayName = CheckboxPrimitives.Root.displayName;

export { Checkbox };
