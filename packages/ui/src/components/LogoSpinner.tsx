export const LogoSpinner = ({ className }: { className: string }) => {
	return (
		<svg
			className={className}
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 49 28"
		>
			<defs>
				<linearGradient id="spinner_d" x1="24.824" x2="32.008" y1="19.667" y2="7.912" gradientUnits="userSpaceOnUse">
					<stop offset=".013" stopColor="#077D43"></stop>
					<stop offset=".125" stopColor="#0A7D4D"></stop>
					<stop offset=".306" stopColor="#0B7F4D"></stop>
					<stop offset=".462" stopColor="#1DA64D"></stop>
					<stop offset=".543" stopColor="#28BD4E"></stop>
					<stop offset=".647" stopColor="#36D94E"></stop>
					<stop offset=".755" stopColor="#37DC4E"></stop>
				</linearGradient>
				<linearGradient id="spinner_c" x1="35.06" x2="50.003" y1="25.293" y2="-.749" gradientUnits="userSpaceOnUse">
					<stop stopColor="#56DD6F"></stop>
					<stop offset=".904" stopColor="#22C23D"></stop>
				</linearGradient>
				<linearGradient id="spinner_b" x1="13.808" x2="12.594" y1="27.23" y2=".385" gradientUnits="userSpaceOnUse">
					<stop stopColor="#098B4E"></stop>
					<stop offset=".326" stopColor="#067A41"></stop>
					<stop offset=".656" stopColor="#06753F"></stop>
					<stop offset="1" stopColor="#066939"></stop>
				</linearGradient>
				<linearGradient id="spinner_a" x1="13.71" x2="13.224" y1="22.63" y2="11.924" gradientUnits="userSpaceOnUse">
					<stop stopColor="#098B4E"></stop>
					<stop offset=".326" stopColor="#067A41"></stop>
					<stop offset=".656" stopColor="#06753F"></stop>
					<stop offset="1" stopColor="#066939"></stop>
				</linearGradient>
			</defs>
			<path fill="url(#spinner_d)" fillRule="evenodd" d="M24.889 18.889c6.158-7.427 11.363-12.032 17.347-15.61 5.675-3.395 8.28-4.496 5.861 4.311a77.17 77.17 0 0 1-.34 1.208c-2.136 7.354-4.601 11.675-6.178 13.802-.297.4-.562.724-.788.974-2.42 2.844-4.417 3.648-5.906 3.648-3.78 0-7.924-4.59-9.996-7.078-2.072 2.489-6.216 7.078-9.996 7.078-1.49 0-3.487-.804-5.906-3.648C7.5 21.923 4.286 17.131 1.681 7.59c-2.42-8.807.186-7.706 5.861-4.312 5.983 3.579 11.19 8.185 17.347 15.611Z" clipRule="evenodd"></path>
			<path fill="#37DC4E" d="M42.236 3.278c-5.983 3.579-11.19 8.184-17.347 15.61l.285.345.114.14.164.187c1.775 2.098 6.089 7.057 9.913 6.987 1.392-.025 3.246-.813 5.458-3.52.678-.783 1.742-2.301 2.92-4.736 1.24-2.21 2.666-5.313 4.014-9.493.115-.394.228-.796.34-1.208 2.42-8.807-.186-7.706-5.861-4.312Z"></path>
			<path fill="url(#spinner_c)" fillRule="evenodd" d="M35.233 25.897c1.333 0 3.121-.721 5.287-3.275 1.333-1.482 4.21-5.784 6.542-14.35 2.166-7.906-.166-6.918-5.248-3.87-5.507 3.302-10.278 7.578-15.995 14.577 1.633 2.006 5.717 6.918 9.414 6.918Z" clipRule="evenodd"></path>
			<path fill="url(#spinner_b)" fillRule="evenodd" d="M14.892 27.222c-1.488 0-3.486-.804-5.905-3.648C7.5 21.923 4.286 17.131 1.681 7.59c-2.42-8.807.186-7.706 5.861-4.312 6.15 3.678 11.479 8.442 17.864 16.238-1.824 2.235-6.385 7.706-10.514 7.706Z" clipRule="evenodd"></path>
			<path fill="url(#spinner_a)" fillRule="evenodd" d="M14.797 26.551c-1.355 0-3.174-.734-5.377-3.33-1.356-1.508-4.282-5.884-6.654-14.596C.563.584 2.936 1.59 8.104 4.688c5.6 3.358 10.453 7.708 16.268 14.827-1.661 2.04-5.815 7.036-9.575 7.036Z" clipRule="evenodd"></path>
		</svg>
	);
};
